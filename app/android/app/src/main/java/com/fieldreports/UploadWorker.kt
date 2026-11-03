package com.fieldreports

import android.content.Context
import android.net.Uri
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.asRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.TimeUnit

class UploadWorker(
    private val context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {

    companion object {
        private const val TAG = "UploadWorker"
        private const val QUEUE_KEY_PERSISTENT = "@field_reports_persistent_queue_v1"
        private const val QUEUE_KEY_LEGACY = "@field_reports_queue_v1"
    }

    override suspend fun doWork(): Result {
        Log.i(TAG, "UploadWorker woke up to process pending queue in background")
        return try {
            val queueFile = File(context.filesDir, "pending_queue.json")
            var queueContent: String? = null

            if (queueFile.exists()) {
                queueContent = queueFile.readText()
            }

            // Fallback: If pending_queue.json is missing, attempt to read from SQLite AsyncStorage
            if (queueContent.isNullOrBlank()) {
                Log.d(TAG, "pending_queue.json is missing or empty, attempting to read from AsyncStorage SQLite")
                queueContent = readQueueFromAsyncStorage()
                if (!queueContent.isNullOrBlank()) {
                    queueFile.writeText(queueContent)
                }
            }

            if (queueContent.isNullOrBlank()) {
                Log.i(TAG, "No pending queue found on disk. UploadWorker exiting successfully.")
                return Result.success()
            }

            val reportsArray = JSONArray(queueContent)
            if (reportsArray.length() == 0) {
                Log.i(TAG, "Pending queue is empty array. UploadWorker exiting.")
                return Result.success()
            }

            var configuredUrl = "https://dd97-103-163-254-137.ngrok-free.app"
            val configFile = File(context.filesDir, "upload_config.json")
            if (configFile.exists()) {
                val cfg = JSONObject(configFile.readText())
                configuredUrl = cfg.optString("baseUrl", configuredUrl)
            }

            val candidateUrls = mutableListOf<String>()
            if (configuredUrl.isNotBlank()) {
                candidateUrls.add(configuredUrl)
            }
            candidateUrls.add("https://dd97-103-163-254-137.ngrok-free.app")
            candidateUrls.add("http://127.0.0.1:3000")
            candidateUrls.add("http://localhost:3000")
            candidateUrls.add("http://10.0.2.2:3000")

            val client = OkHttpClient.Builder()
                .connectTimeout(12, TimeUnit.SECONDS)
                .readTimeout(30, TimeUnit.SECONDS)
                .writeTimeout(30, TimeUnit.SECONDS)
                .build()

            // Resolve reachable backend host
            var activeBaseUrl: String? = null
            for (url in candidateUrls.distinct()) {
                try {
                    val healthReq = Request.Builder()
                        .url("$url/health")
                        .addHeader("ngrok-skip-browser-warning", "true")
                        .get()
                        .build()
                    val resp = client.newCall(healthReq).execute()
                    if (resp.isSuccessful) {
                        activeBaseUrl = url
                        resp.close()
                        Log.i(TAG, "Resolved reachable backend server at: $url")
                        break
                    }
                    resp.close()
                } catch (e: Exception) {
                    Log.d(TAG, "Candidate $url not reachable: ${e.message}")
                }
            }

            if (activeBaseUrl == null) {
                Log.w(TAG, "No backend server reachable, WorkManager will retry")
                return Result.retry()
            }

            var anyUploaded = false

            for (i in 0 until reportsArray.length()) {
                val report = reportsArray.getJSONObject(i)
                val status = report.optString("status", "")
                if (status != "in_queue" && status != "uploading") {
                    continue
                }

                val reportId = report.getString("id")
                val description = report.optString("description", "")
                val attachments = report.optJSONArray("attachments") ?: JSONArray()
                Log.i(TAG, "Processing report: $reportId with ${attachments.length()} photos")

                val multipartBuilder = MultipartBody.Builder()
                    .setType(MultipartBody.FORM)
                    .addFormDataPart("reportId", reportId)
                    .addFormDataPart("description", description)

                var photoCount = 0
                for (j in 0 until attachments.length()) {
                    val att = attachments.getJSONObject(j)
                    val uriStr = att.getString("uri")
                    val fileName = att.optString("fileName", "photo_$j.jpg")
                    val file = resolveFileFromUri(uriStr, fileName)

                    if (file != null && file.exists()) {
                        val body = file.asRequestBody("image/jpeg".toMediaTypeOrNull())
                        multipartBuilder.addFormDataPart("images", fileName, body)
                        photoCount++
                    } else {
                        Log.w(TAG, "Could not resolve file for attachment $fileName at $uriStr")
                    }
                }

                val uploadRequest = Request.Builder()
                    .url("$activeBaseUrl/reports")
                    .addHeader("Idempotency-Key", reportId)
                    .addHeader("Accept", "application/json")
                    .addHeader("ngrok-skip-browser-warning", "true")
                    .post(multipartBuilder.build())
                    .build()

                Log.i(TAG, "Posting report $reportId to $activeBaseUrl/reports (photos: $photoCount)")
                val uploadResp = client.newCall(uploadRequest).execute()
                val responseCode = uploadResp.code
                val responseBodyStr = uploadResp.body?.string() ?: ""
                uploadResp.close()

                Log.i(TAG, "Server responded with status code: $responseCode")

                if (uploadResp.isSuccessful || responseCode == 200 || responseCode == 201) {
                    val serverId = try {
                        val obj = JSONObject(responseBodyStr)
                        obj.optJSONObject("report")?.optString("id")
                            ?: obj.optString("reportId", reportId)
                    } catch (e: Exception) {
                        reportId
                    }
                    report.put("status", "delivered")
                    report.put("serverReportId", serverId)
                    anyUploaded = true
                    Log.i(TAG, "Report $reportId successfully delivered to server! ID: $serverId")
                } else if (responseCode in 400..499) {
                    report.put("status", "failed")
                    Log.e(TAG, "Report $reportId non-retryable failure: $responseCode $responseBodyStr")
                } else {
                    Log.w(TAG, "Report $reportId server error $responseCode, will retry")
                    return Result.retry()
                }
            }

            if (anyUploaded) {
                queueFile.writeText(reportsArray.toString())
                syncToAsyncStorage(reportsArray.toString())
                Log.i(TAG, "Persisted delivered status to disk queue and SQLite")
            }

            Result.success()
        } catch (e: Exception) {
            Log.e(TAG, "UploadWorker failed with exception", e)
            Result.retry()
        }
    }

    private fun resolveFileFromUri(uriStr: String, fileName: String): File? {
        return try {
            val parsedUri = Uri.parse(uriStr)
            if (uriStr.startsWith("file://")) {
                val f = File(parsedUri.path ?: uriStr.removePrefix("file://"))
                if (f.exists()) return f
            } else if (!uriStr.startsWith("content://")) {
                val f = File(uriStr)
                if (f.exists()) return f
            }

            // Stream through ContentResolver for content:// or sandboxed URIs
            val tempFile = File(context.cacheDir, "bg_${System.currentTimeMillis()}_$fileName")
            context.contentResolver.openInputStream(parsedUri)?.use { input ->
                FileOutputStream(tempFile).use { output ->
                    input.copyTo(output)
                }
            }
            if (tempFile.exists() && tempFile.length() > 0) tempFile else null
        } catch (e: Exception) {
            Log.w(TAG, "resolveFileFromUri failed for $uriStr: ${e.message}")
            null
        }
    }

    private fun readQueueFromAsyncStorage(): String? {
        val dbNames = listOf("AsyncStorage", "RKStorage")
        val tableNames = listOf("Storage", "catalystLocalStorage")
        val keys = arrayOf(QUEUE_KEY_PERSISTENT, QUEUE_KEY_LEGACY)

        for (dbName in dbNames) {
            try {
                val dbFile = context.getDatabasePath(dbName)
                if (dbFile.exists()) {
                    val db = android.database.sqlite.SQLiteDatabase.openDatabase(
                        dbFile.absolutePath,
                        null,
                        android.database.sqlite.SQLiteDatabase.OPEN_READONLY
                    )
                    for (table in tableNames) {
                        for (k in keys) {
                            try {
                                val cursor = db.rawQuery(
                                    "SELECT value FROM $table WHERE key = ? LIMIT 1",
                                    arrayOf(k)
                                )
                                if (cursor.moveToFirst()) {
                                    val json = cursor.getString(0)
                                    cursor.close()
                                    db.close()
                                    if (!json.isNullOrBlank()) {
                                        return json
                                    }
                                }
                                cursor.close()
                            } catch (_: Exception) {}
                        }
                    }
                    db.close()
                }
            } catch (_: Exception) {}
        }
        return null
    }

    private fun syncToAsyncStorage(updatedQueueJson: String) {
        val dbNames = listOf("AsyncStorage", "RKStorage")
        val tableNames = listOf("Storage", "catalystLocalStorage")
        val keys = arrayOf(QUEUE_KEY_PERSISTENT, QUEUE_KEY_LEGACY)

        for (dbName in dbNames) {
            try {
                val dbFile = context.getDatabasePath(dbName)
                if (dbFile.exists()) {
                    val db = android.database.sqlite.SQLiteDatabase.openDatabase(
                        dbFile.absolutePath,
                        null,
                        android.database.sqlite.SQLiteDatabase.OPEN_READWRITE
                    )
                    val cv = android.content.ContentValues().apply {
                        put("value", updatedQueueJson)
                    }
                    for (table in tableNames) {
                        for (k in keys) {
                            try {
                                db.update(table, cv, "key = ?", arrayOf(k))
                            } catch (_: Exception) {}
                        }
                    }
                    db.close()
                }
            } catch (e: Exception) {
                Log.w(TAG, "Error syncing to AsyncStorage SQLite ($dbName): ${e.message}")
            }
        }
    }
}
