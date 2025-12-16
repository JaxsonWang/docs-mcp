import {
  env,
  pipeline,
  type FeatureExtractionPipeline,
  type PipelineType,
} from "@xenova/transformers";

env.allowLocalModels = true;

export class EmbeddingModel {
  private readonly modelName: string;
  private pipelinePromise?: Promise<FeatureExtractionPipeline>;

  constructor(modelName: string) {
    this.modelName = modelName;
  }

  private loadPipeline(): Promise<FeatureExtractionPipeline> {
    if (!this.pipelinePromise) {
      this.pipelinePromise = pipeline("feature-extraction" as PipelineType, this.modelName, {
        quantized: true,
      }) as Promise<FeatureExtractionPipeline>;
    }
    return this.pipelinePromise;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (!texts.length) {
      return [];
    }
    const extractor = await this.loadPipeline();
    const embeddings: number[][] = [];
    for (const text of texts) {
      const result: any = await extractor(text, {
        pooling: "mean",
        normalize: true,
      });
      const vector = Array.from(result.data as Float32Array).map((value) => Number(value));
      embeddings.push(vector);
    }
    return embeddings;
  }
}
