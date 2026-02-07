declare module "content-type" {
	export interface ParsedMediaType {
		type: string;
		parameters: Record<string, string>;
	}

	export interface MediaType {
		type: string;
		parameters?: Record<string, string>;
	}

	export function parse(input: string | { headers: { [key: string]: string | string[] | undefined } }): ParsedMediaType;
	export function format(obj: MediaType): string;

	const contentType: {
		parse: typeof parse;
		format: typeof format;
	};

	export default contentType;
}
