package com.fieldreports

import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import org.json.JSONObject
import java.io.File
import java.util.concurrent.TimeUnit

class UploadWorkManagerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "UploadWorkManager"

    @ReactMethod
    fun scheduleUploadWork(promise: Promise) {
        scheduleInternal(null, null, promise)
    }

    @ReactMethod
    fun scheduleUploadWorkWithConfig(queueJson: String, baseUrl: String, promise: Promise) {
        scheduleInternal(queueJson, baseUrl, promise)
    }

    @ReactMethod
    fun getPendingQueue(promise: Promise) {
        try {
            val queueFile = File(reactApplicationContext.filesDir, "pending_queue.json")
            if (queueFile.exists()) {
                promise.resolve(queueFile.readText())
            } else {
                promise.resolve(null)
            }
        } catch (e: Exception) {
            promise.resolve(null)
        }
    }

    private fun scheduleInternal(queueJson: String?, baseUrl: String?, promise: Promise) {
        try {
            if (!queueJson.isNullOrBlank()) {
                val queueFile = File(reactApplicationContext.filesDir, "pending_queue.json")
                queueFile.writeText(queueJson)
            }

            if (!baseUrl.isNullOrBlank()) {
                val configFile = File(reactApplicationContext.filesDir, "upload_config.json")
                val cfg = JSONObject().apply {
                    put("baseUrl", baseUrl)
                }
                configFile.writeText(cfg.toString())
            }

            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            // Schedule immediate one-time work triggered when network connects
            val oneTimeRequest = OneTimeWorkRequestBuilder<UploadWorker>()
                .setConstraints(constraints)
                .build()

            WorkManager.getInstance(reactApplicationContext).enqueueUniqueWork(
                "FieldReportsUploadOneTime",
                ExistingWorkPolicy.REPLACE,
                oneTimeRequest
            )

            // Also schedule periodic background check every 15 minutes
            val periodicRequest = PeriodicWorkRequestBuilder<UploadWorker>(15, TimeUnit.MINUTES)
                .setConstraints(constraints)
                .build()

            WorkManager.getInstance(reactApplicationContext).enqueueUniquePeriodicWork(
                "FieldReportsUploadPeriodic",
                ExistingPeriodicWorkPolicy.KEEP,
                periodicRequest
            )

            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("WORK_MANAGER_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun cancelUploadWork(promise: Promise) {
        try {
            WorkManager.getInstance(reactApplicationContext).cancelUniqueWork("FieldReportsUploadOneTime")
            WorkManager.getInstance(reactApplicationContext).cancelUniqueWork("FieldReportsUploadPeriodic")
            val queueFile = File(reactApplicationContext.filesDir, "pending_queue.json")
            if (queueFile.exists()) {
                queueFile.delete()
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("WORK_MANAGER_ERROR", e.message, e)
        }
    }
}
