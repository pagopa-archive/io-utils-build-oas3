import { ITuple2 } from "italia-ts-commons/lib/tuples";
import * as nunjucks from "nunjucks";
import { OpenAPI, OpenAPIV2 } from "openapi-types";
export declare function renderDefinitionCode(env: nunjucks.Environment, definitionName: string, definition: OpenAPIV2.DefinitionsObject, strictInterfaces: boolean): Promise<string>;
export declare function renderOperation(method: string, operationId: string, operation: OpenAPIV2.OperationObject, specParameters: OpenAPIV2.ParametersDefinitionsObject | undefined, securityDefinitions: OpenAPIV2.SecurityDefinitionsObject | undefined, extraHeaders: ReadonlyArray<string>, extraParameters: {
    [key: string]: string;
}, defaultSuccessType: string, defaultErrorType: string, generateResponseDecoders: boolean): ITuple2<string, ReadonlySet<string>>;
export declare function isOpenAPIV2(specs: OpenAPI.Document): specs is OpenAPIV2.Document;
export declare function generateApi(env: nunjucks.Environment, specFilePath: string | OpenAPIV2.Document, definitionsDirPath: string, tsSpecFilePath: string | undefined, strictInterfaces: boolean, generateRequestTypes: boolean, defaultSuccessType: string, defaultErrorType: string, generateResponseDecoders: boolean): Promise<void>;
export declare function initNunJucksEnvironment(): nunjucks.Environment;
