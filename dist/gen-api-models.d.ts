import { ITuple2 } from "italia-ts-commons/lib/tuples";
import * as nunjucks from "nunjucks";
import { OpenAPI, OpenAPIV2, OpenAPIV3 } from "openapi-types";
export declare function renderDefinitionCode(env: nunjucks.Environment, definitionName: string, definition: OpenAPIV2.DefinitionsObject | OpenAPIV3.ComponentsObject, strictInterfaces: boolean): Promise<string>;
export declare function renderOperation(method: string, operationId: string, operation: OpenAPI.Operation, specParameters: OpenAPIV2.ParametersDefinitionsObject | OpenAPIV3.ParameterObject, securityDefinitions: OpenAPIV2.SecurityDefinitionsObject | OpenAPIV3.SecurityRequirementObject, extraHeaders: ReadonlyArray<string>, extraParameters: {
    [key: string]: string;
}, defaultSuccessType: string, defaultErrorType: string, generateResponseDecoders: boolean): ITuple2<string, ReadonlySet<string>>;
export declare function detectVersion(api: any): {
    definitions: any;
    parameters: any;
    schemasPath: string;
    securityPath: any;
    version: any;
};
export declare function isOpenAPIV2(specs: OpenAPI.Document): specs is OpenAPIV2.Document;
export declare function isOpenAPIV3(specs: OpenAPI.Document): specs is OpenAPIV3.Document;
export declare function generateApi(env: nunjucks.Environment, specFilePath: string, definitionsDirPath: string, tsSpecFilePath: string | undefined, strictInterfaces: boolean, generateRequestTypes: boolean, defaultSuccessType: string, defaultErrorType: string, generateResponseDecoders: boolean): Promise<void>;
export declare function initNunJucksEnvironment(): nunjucks.Environment;
