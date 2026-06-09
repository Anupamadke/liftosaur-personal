import { NativeTimerBridge_playSound } from "../utils/nativeTimerBridge";

export interface IAudioInterface {
  play(volume: number, vibration: boolean): void;
}

export class MockAudioInterface implements IAudioInterface {
  public play(volume: number, vibration: boolean): void {
    // noop
  }
}

export class AudioInterface implements IAudioInterface {
  private readonly audio: HTMLAudioElement;

  constructor() {
    this.audio = new Audio("/notification.m4r");
  }

  public play(volume: number, vibration: boolean): void {
    if (volume <= 0 && !vibration) {
      return;
    }
    const isPlayed = NativeTimerBridge_playSound(volume, vibration);
    if (!isPlayed && volume > 0) {
      this.audio.volume = volume;
      this.audio.play();
    }
  }
}
