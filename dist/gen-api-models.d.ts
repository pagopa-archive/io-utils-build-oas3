import { ITuple2 } from "italia-ts-commons/lib/tuples";
import * as nunjucks from "nunjucks";
import { Operation, Schema, Spec } from "swagger-schema-official";
export declare function renderDefinitionCode(env: nunjucks.Environment, definitionName: string, definition: Schema, strictInterfaces: boolean): Promise<string>;
export declare function renderOperation(method: string, operationId: string, operation: Operation, specParameters: Spec["parameters"], securityDefinitions: Spec["securityDefinitions"], extraHeaders: ReadonlyArray<string>, extraParameters: {
    [key: string]: string;
}, defaultSuccessType: string, defaultErrorType: string, generateResponseDecoders: boolean): ITuple2<string, ReadonlySet<string>>;
export declare function generateApi(env: nunjucks.Environment, specFilePath: string | Spec, definitionsDirPath: string, tsSpecFilePath: string | undefined, strictInterfaces: boolean, generateRequestTypes: boolean, defaultSuccessType: string, defaultErrorType: string, generateResponseDecoders: boolean): Promise<void>;
export declare function initNunJucksEnvironment(): nunjucks.Environment;
