import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Alert, Text } from 'react-native';
import { ChaosResetModal } from '../src/screens/ChaosResetModal';
import { ChaosConfig } from '../src/domain/types';

describe('Settings & Network Simulation Modal', () => {
  const mockOnClose = jest.fn();
  const mockOnUpdateChaos = jest.fn();
  const mockOnExecuteReset = jest.fn();

  const healthyChaosConfig: ChaosConfig = {
    latencyMs: 0,
    dropConnection: false,
    simulate500: false,
    hangRequest: false,
    lostResponse: false,
  };

  const activeChaosConfig: ChaosConfig = {
    latencyMs: 3000,
    dropConnection: true,
    simulate500: false,
    hangRequest: false,
    lostResponse: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      // Automatically confirm the destructive action in test
      if (buttons && buttons.length > 1 && buttons[1].onPress) {
        buttons[1].onPress();
      }
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('displays link healthy banner when no faults are active', async () => {
    let root: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      root = ReactTestRenderer.create(
        <ChaosResetModal
          visible={true}
          onClose={mockOnClose}
          chaosConfig={healthyChaosConfig}
          onUpdateChaos={mockOnUpdateChaos}
          onExecuteReset={mockOnExecuteReset}
        />,
      );
    });

    const allText = root!.root.findAllByType(Text).map(t => Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children || ''));
    expect(allText.some(t => t.includes('Normal connection'))).toBe(true);
  });

  it('displays active fault tags when conditions are simulated', async () => {
    let root: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      root = ReactTestRenderer.create(
        <ChaosResetModal
          visible={true}
          onClose={mockOnClose}
          chaosConfig={activeChaosConfig}
          onUpdateChaos={mockOnUpdateChaos}
          onExecuteReset={mockOnExecuteReset}
        />,
      );
    });

    const allText = root!.root.findAllByType(Text).map(t => Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children || ''));
    expect(allText.some(t => t.includes('Active condition:'))).toBe(true);
    expect(allText.some(t => t.includes('+3s delay'))).toBe(true);
    expect(allText.some(t => t.includes('Connection drop'))).toBe(true);
  });

  it('triggers slow network (2G delay) on tap', async () => {
    let root: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      root = ReactTestRenderer.create(
        <ChaosResetModal
          visible={true}
          onClose={mockOnClose}
          chaosConfig={healthyChaosConfig}
          onUpdateChaos={mockOnUpdateChaos}
          onExecuteReset={mockOnExecuteReset}
        />,
      );
    });

    const preset1 = root!.root.findByProps({ accessibilityLabel: 'Slow network preset' });
    expect(preset1).toBeDefined();
    await ReactTestRenderer.act(async () => {
      preset1.props.onPress();
    });

    expect(mockOnUpdateChaos).toHaveBeenCalledWith({
      latencyMs: 3000,
      dropConnection: false,
      simulate500: false,
      hangRequest: false,
      lostResponse: false,
    });
  });

  it('triggers drop connection mid-upload on tap', async () => {
    let root: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      root = ReactTestRenderer.create(
        <ChaosResetModal
          visible={true}
          onClose={mockOnClose}
          chaosConfig={healthyChaosConfig}
          onUpdateChaos={mockOnUpdateChaos}
          onExecuteReset={mockOnExecuteReset}
        />,
      );
    });

    const preset2 = root!.root.findByProps({ accessibilityLabel: 'Connection drops preset' });
    expect(preset2).toBeDefined();
    await ReactTestRenderer.act(async () => {
      preset2.props.onPress();
    });

    expect(mockOnUpdateChaos).toHaveBeenCalledWith({
      latencyMs: 0,
      dropConnection: true,
      simulate500: false,
      hangRequest: false,
      lostResponse: false,
    });
  });

  it('triggers lost response on tap when server saves report then loses reply', async () => {
    let root: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      root = ReactTestRenderer.create(
        <ChaosResetModal
          visible={true}
          onClose={mockOnClose}
          chaosConfig={healthyChaosConfig}
          onUpdateChaos={mockOnUpdateChaos}
          onExecuteReset={mockOnExecuteReset}
        />,
      );
    });

    const presetLost = root!.root.findByProps({ accessibilityLabel: 'Server saves then loses reply preset' });
    expect(presetLost).toBeDefined();
    await ReactTestRenderer.act(async () => {
      presetLost.props.onPress();
    });

    expect(mockOnUpdateChaos).toHaveBeenCalledWith({
      latencyMs: 0,
      dropConnection: false,
      simulate500: false,
      hangRequest: false,
      lostResponse: true,
    });
  });

  it('triggers Restore normal connection on tap', async () => {
    let root: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      root = ReactTestRenderer.create(
        <ChaosResetModal
          visible={true}
          onClose={mockOnClose}
          chaosConfig={activeChaosConfig}
          onUpdateChaos={mockOnUpdateChaos}
          onExecuteReset={mockOnExecuteReset}
        />,
      );
    });

    const restorePreset = root!.root.findByProps({ accessibilityLabel: 'Restore normal connection preset' });
    expect(restorePreset).toBeDefined();
    await ReactTestRenderer.act(async () => {
      restorePreset.props.onPress();
    });

    expect(mockOnUpdateChaos).toHaveBeenCalledWith({
      latencyMs: 0,
      dropConnection: false,
      simulate500: false,
      hangRequest: false,
      lostResponse: false,
    });
  });

  it('allows selecting clear phone and server and confirms execution', async () => {
    let root: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      root = ReactTestRenderer.create(
        <ChaosResetModal
          visible={true}
          onClose={mockOnClose}
          chaosConfig={healthyChaosConfig}
          onUpdateChaos={mockOnUpdateChaos}
          onExecuteReset={mockOnExecuteReset}
        />,
      );
    });

    // Select Clear phone and server option
    const fullWipeOption = root!.root.findByProps({ accessibilityLabel: 'Clear phone and server' });
    expect(fullWipeOption).toBeDefined();
    await ReactTestRenderer.act(async () => {
      fullWipeOption.props.onPress();
    });

    // Press execute reset button
    const executeBtn = root!.root.findByProps({ title: 'Clear phone and server' });
    expect(executeBtn).toBeDefined();

    await ReactTestRenderer.act(async () => {
      executeBtn.props.onPress();
    });

    expect(Alert.alert).toHaveBeenCalled();
    expect(mockOnExecuteReset).toHaveBeenCalledWith('full_system_wipe');
  });

  it('calls onClose when tapping close button or outside backdrop', async () => {
    let root: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      root = ReactTestRenderer.create(
        <ChaosResetModal
          visible={true}
          onClose={mockOnClose}
          chaosConfig={healthyChaosConfig}
          onUpdateChaos={mockOnUpdateChaos}
          onExecuteReset={mockOnExecuteReset}
        />,
      );
    });

    // Close button in header
    const closeBtn = root!.root.findByProps({ accessibilityLabel: 'Close modal' });
    await ReactTestRenderer.act(async () => {
      closeBtn.props.onPress();
    });

    expect(mockOnClose).toHaveBeenCalledTimes(1);

    // Backdrop outside tap
    const backdrop = root!.root.findByProps({ accessibilityLabel: 'Close modal by tapping outside' });
    await ReactTestRenderer.act(async () => {
      backdrop.props.onPress();
    });

    expect(mockOnClose).toHaveBeenCalledTimes(2);
  });
});
