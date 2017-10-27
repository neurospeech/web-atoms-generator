export class GeneratorContext {

	static instance: GeneratorContext = new GeneratorContext();

	fileName: string;
	fileLines: Array<number> = [];

}