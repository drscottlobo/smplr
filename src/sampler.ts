import {
  AudioBuffers,
  AudioBuffersLoader,
  loadAudioBuffer,
} from "./player/load-audio";
import { midiVelToGain } from "./player/midi";
import { Player } from "./player/player";
import { SampleStart, SampleStop } from "./player/types";
import { HttpStorage, Storage } from "./storage";

export type SamplerConfig = {
  storage?: Storage;
  detune: number;
  volume: number;
  velocity: number;
  decayTime?: number;
  lpfCutoffHz?: number;
  destination: AudioNode;

  buffers: Record<string | number, string | AudioBuffers> | AudioBuffersLoader;
  volumeToGain: (volume: number) => number;
};

/**
 * A Sampler instrument
 *
 * @private
 */
export class Sampler {
  #options: SamplerConfig;
  #load: Promise<void>;
  private readonly player: Player;

  public constructor(
    public readonly context: AudioContext,
    options: Partial<SamplerConfig> = {}
  ) {
    this.#options = {
      destination: options.destination ?? context.destination,
      detune: 0,
      volume: options.volume ?? 100,
      velocity: options.velocity ?? 100,
      buffers: options.buffers ?? {},
      volumeToGain: options.volumeToGain ?? midiVelToGain,
    };
    this.player = new Player(context, this.#options);
    const storage = options.storage ?? HttpStorage;
    const loader =
      typeof this.#options.buffers === "function"
        ? this.#options.buffers
        : createAudioBuffersLoader(this.#options.buffers, storage);
    this.#load = loader(context, this.player.buffers);
  }

  async loaded(): Promise<this> {
    await this.#load;
    return this;
  }

  get output() {
    return this.player.output;
  }

  start(sample: SampleStart | string | number) {
    return this.player.start(
      typeof sample === "object" ? sample : { note: sample }
    );
  }

  stop(sample?: SampleStop | string | number) {
    return this.player.stop(
      typeof sample === "object"
        ? sample
        : sample === undefined
        ? undefined
        : { stopId: sample }
    );
  }

  disconnect() {
    return this.player.disconnect();
  }
}

function createAudioBuffersLoader(
  source: Record<string | number, string | AudioBuffers>,
  storage: Storage
): AudioBuffersLoader {
  return async (context, buffers) => {
    await Promise.all([
      Object.keys(source).map(async (key) => {
        const value = source[key];
        if (value instanceof AudioBuffer) {
          buffers[key] = value;
        } else if (typeof value === "string") {
          const buffer = await loadAudioBuffer(context, value, storage);
          if (buffer) buffers[key] = buffer;
        }
      }),
    ]);
  };
}
