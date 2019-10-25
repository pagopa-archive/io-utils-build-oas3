"use strict";
// tslint:disable:no-console
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs-extra");
const tuples_1 = require("italia-ts-commons/lib/tuples");
const nunjucks = require("nunjucks");
const prettier = require("prettier");
const SwaggerParser = require("swagger-parser");
const SUPPORTED_SPEC_METHODS = ["get", "post", "put", "delete"];
function renderAsync(env, definition, definitionName, strictInterfaces) {
    return new Promise((accept, reject) => {
        env.render("model.ts.njk", {
            definition,
            definitionName,
            strictInterfaces
        }, (err, res) => {
            if (err) {
                return reject(err);
            }
            accept(res);
        });
    });
}
function renderDefinitionCode(env, definitionName, definition, strictInterfaces) {
    return __awaiter(this, void 0, void 0, function* () {
        const code = yield renderAsync(env, definition, definitionName, strictInterfaces);
        const prettifiedCode = prettier.format(code, {
            parser: "typescript"
        });
        return prettifiedCode;
    });
}
exports.renderDefinitionCode = renderDefinitionCode;
function capitalize(s) {
    return `${s[0].toUpperCase()}${s.slice(1)}`;
}
function uncapitalize(s) {
    return `${s[0].toLowerCase()}${s.slice(1)}`;
}
function typeFromRef(s) {
    const parts = s.split("/");
    if (!parts) {
        return undefined;
    }
    // If it's an OAS3, remove the "components" part.
    if (parts[1] === "components") {
        parts.splice(1, 1);
    }
    if (parts && parts.length === 3) {
        const refType = parts[1] === "definitions"
            ? "definition"
            : parts[1] === "schemas"
                ? "definition"
                : parts[1] === "parameters"
                    ? "parameter"
                    : "other";
        return tuples_1.Tuple2(refType, parts[2]);
    }
    return undefined;
}
function specTypeToTs(t) {
    switch (t) {
        case "integer":
            return "number";
        case "file":
            return "{ uri: string, name: string, type: string }";
        default:
            return t;
    }
}
function getDecoderForResponse(status, type) {
    switch (type) {
        case "undefined":
            return `r.constantResponseDecoder<undefined, ${status}>(${status}, undefined)`;
        case "Error":
            return `r.basicErrorResponseDecoder<${status}>(${status})`;
        default:
            return `r.ioResponseDecoder<${status}, (typeof ${type})["_A"], (typeof ${type})["_O"]>(${status}, ${type})`;
    }
}
function renderOperation(method, operationId, operation, specParameters, securityDefinitions, extraHeaders, extraParameters, defaultSuccessType, defaultErrorType, generateResponseDecoders) {
    const requestType = `r.I${capitalize(method)}ApiRequestType`;
    const params = {};
    const importedTypes = new Set();
    if (operation.parameters !== undefined) {
        const parameters = operation.parameters;
        parameters.forEach(param => {
            if (param.name && param.type) {
                // The parameter description is inline
                const isRequired = param.required === true;
                params[`${param.name}${isRequired ? "" : "?"}`] = specTypeToTs(param.type);
                return;
            }
            // Paratemer is declared as ref, we need to look it up
            const refInParam = param.$ref ||
                (param.schema ? param.schema.$ref : undefined);
            if (refInParam === undefined) {
                console.warn(`Skipping param without ref in operation [${operationId}] [${param.name}]`);
                return;
            }
            const parsedRef = typeFromRef(refInParam);
            if (parsedRef === undefined) {
                console.warn(`Cannot extract type from ref [${refInParam}]`);
                return;
            }
            const refType = parsedRef.e1;
            if (refType === "other") {
                console.warn(`Unrecognized ref type [${refInParam}]`);
                return;
            }
            // if the reference type is  "definition"
            // e2 contains a schema object
            // otherwise it is the schema name
            const paramType = refType === "definition"
                ? parsedRef.e2
                : specParameters
                    ? specTypeToTs(specParameters[parsedRef.e2].type
                        || specParameters[parsedRef.e2].schema.type)
                    : undefined;
            if (paramType === undefined) {
                console.warn(`Cannot resolve parameter ${parsedRef.e2}`);
                return;
            }
            const isParamRequired = refType === "definition"
                ? param.required === true
                : specParameters
                    ? specParameters[parsedRef.e2].required
                    : false;
            const paramName = `${uncapitalize(parsedRef.e2)}${isParamRequired ? "" : "?"}`;
            params[paramName] = paramType;
            if (refType === "definition") {
                importedTypes.add(parsedRef.e2);
            }
        });
    }
    const authHeadersAndParams = operation.security
        ? getAuthHeaders(securityDefinitions, operation.security
            .map((_) => Object.keys(_)[0])
            .filter(_ => _ !== undefined))
        : [];
    const authParams = {};
    authHeadersAndParams.forEach(_ => (authParams[_.e1] = "string"));
    const allParams = Object.assign({}, extraParameters, authParams, params);
    const paramsCode = Object.keys(allParams)
        .map(paramKey => `readonly ${paramKey}: ${allParams[paramKey]}`)
        .join(",");
    const contentTypeHeaders = (method === "post" || method === "put") && Object.keys(params).length > 0
        ? ["Content-Type"]
        : [];
    const authHeaders = authHeadersAndParams.map(_ => _.e2);
    const headers = [...contentTypeHeaders, ...authHeaders, ...extraHeaders];
    const headersCode = headers.length > 0 ? headers.map(_ => `"${_}"`).join("|") : "never";
    const responses = Object.keys(operation.responses).map(responseStatus => {
        const response = operation.responses[responseStatus];
        const media_type = "application/json";
        const typeRef = 
        // get schema from Swagger...
        response.schema
            ? response.schema.$ref
            // ... or try with OAS3
            : response.content
                ? response.content[media_type]
                    && response.content[media_type].schema
                    ? response.content[media_type].schema.$ref
                    : undefined
                // Not OAS2 or missing media-type in response.content
                : undefined;
        const parsedRef = typeRef ? typeFromRef(typeRef) : undefined;
        if (parsedRef !== undefined) {
            importedTypes.add(parsedRef.e2);
        }
        const responseType = parsedRef
            ? parsedRef.e2
            : responseStatus === "200"
                ? defaultSuccessType
                : defaultErrorType;
        return tuples_1.Tuple2(responseStatus, responseType);
    });
    const responsesType = responses
        .map(r => `r.IResponseType<${r.e1}, ${r.e2}>`)
        .join("|");
    // use the first 2xx type as "success type" that we allow to be overridden
    const successType = responses.find(_ => _.e1.length === 3 && _.e1[0] === "2");
    const responsesDecoderCode = generateResponseDecoders && successType !== undefined
        ? `
        // Decodes the success response with a custom success type
        export function ${operationId}Decoder<A, O>(type: t.Type<A, O>) { return ` +
            responses.reduce((acc, r) => {
                const d = getDecoderForResponse(r.e1, successType !== undefined && r.e1 === successType.e1 ? "type" : r.e2);
                return acc === "" ? d : `r.composeResponseDecoders(${acc}, ${d})`;
            }, "") +
            `; }

        // Decodes the success response with the type defined in the specs
        export const ${operationId}DefaultDecoder = () => ${operationId}Decoder(${successType.e2 === "undefined" ? "t.undefined" : successType.e2});`
        : "";
    const code = `
    /****************************************************************
     * ${operationId}
     */

    // Request type definition
    export type ${capitalize(operationId)}T = ${requestType}<{${paramsCode}}, ${headersCode}, never, ${responsesType}>;
  ` + responsesDecoderCode;
    return tuples_1.Tuple2(code, importedTypes);
}
exports.renderOperation = renderOperation;
function getAuthHeaders(securityDefinitions, securityKeys) {
    if (securityKeys === undefined && securityDefinitions === undefined) {
        return [];
    }
    const securityDefs = securityKeys !== undefined && securityDefinitions !== undefined
        ? // If we have both security and securityDefinitions defined, we extract
            // security items mapped to their securityDefinitions definitions.
            securityKeys.map(k => tuples_1.Tuple2(k, securityDefinitions[k]))
        : securityDefinitions !== undefined
            ? Object.keys(securityDefinitions).map(k => tuples_1.Tuple2(k, securityDefinitions[k]))
            : [];
    return securityDefs
        .filter(_ => _.e2 !== undefined)
        .filter(_ => _.e2.in === "header")
        .map(_ => tuples_1.Tuple2(_.e1, _.e2.name));
}
function detectVersion(api) {
    return api.hasOwnProperty("swagger")
        ? {
            definitions: api.definitions,
            parameters: api.parameters,
            schemasPath: "#/definitions/",
            securityPath: api.securityDefinitions,
            version: api.swagger
        }
        : api.hasOwnProperty("openapi")
            ? {
                definitions: api.components.schemas,
                parameters: api.components.parameters,
                schemasPath: "#/components/schemas/",
                securityPath: api.components.securitySchemes,
                version: api.openapi
            }
            : {
                definitions: undefined,
                parameters: undefined,
                schemasPath: "",
                securityPath: undefined,
                version: ""
            };
}
exports.detectVersion = detectVersion;
function isOpenAPIV2(specs) {
    return specs.hasOwnProperty("swagger");
}
exports.isOpenAPIV2 = isOpenAPIV2;
function isOpenAPIV3(specs) {
    return specs.hasOwnProperty("openapi");
}
exports.isOpenAPIV3 = isOpenAPIV3;
function generateApi(env, specFilePath, definitionsDirPath, tsSpecFilePath, strictInterfaces, generateRequestTypes, defaultSuccessType, defaultErrorType, generateResponseDecoders) {
    return __awaiter(this, void 0, void 0, function* () {
        const api = yield SwaggerParser.bundle(specFilePath);
        const detectedSpecVersion = detectVersion(api);
        if (isOpenAPIV2(api)) {
            console.info("The type of spec. is Swagger");
        }
        else if (isOpenAPIV3(api)) {
            console.info("The type of spec. is OpenAPI");
        }
        else {
            throw new Error("The specification is not correct.");
        }
        const specCode = `
    /* tslint:disable:object-literal-sort-keys */
    /* tslint:disable:no-duplicate-string */

    // DO NOT EDIT
    // auto-generated by generated_model.ts from ${specFilePath}

    export const specs = ${JSON.stringify(api)};
  `;
        if (tsSpecFilePath) {
            console.log(`Writing TS Specs to ${tsSpecFilePath}`);
            yield fs.writeFile(tsSpecFilePath, prettier.format(specCode, {
                parser: "typescript"
            }));
        }
        const { version, parameters, schemasPath, definitions, securityPath } = detectedSpecVersion;
        env.addGlobal("schemas_path", schemasPath);
        if (!definitions) {
            console.log("No definitions found, skipping generation of model code.");
            return;
        }
        for (const definitionName in definitions) {
            if (definitions.hasOwnProperty(definitionName)) {
                const definition = definitions[definitionName];
                const outPath = `${definitionsDirPath}/${definitionName}.ts`;
                console.log(`${definitionName} -> ${outPath}`);
                const code = yield renderDefinitionCode(env, definitionName, definition, strictInterfaces);
                yield fs.writeFile(outPath, code);
            }
        }
        if (generateRequestTypes || generateResponseDecoders) {
            // map global auth headers only if global security is defined
            const globalAuthHeaders = api.security
                ? getAuthHeaders(securityPath, api.security
                    .map(_ => (Object.keys(_).length > 0 ? Object.keys(_)[0] : undefined))
                    .filter(_ => _ !== undefined))
                : [];
            const operationsTypes = Object.keys(api.paths).map(path => {
                const pathSpec = api.paths[path];
                const extraParameters = {};
                if (pathSpec.parameters !== undefined) {
                    pathSpec.parameters.forEach((param) => {
                        const paramType = param.type;
                        if (paramType) {
                            const paramName = `${param.name}${param.required === true ? "" : "?"}`;
                            extraParameters[paramName] = specTypeToTs(paramType);
                        }
                    });
                }
                // add global auth parameters to extraParameters
                globalAuthHeaders.forEach(_ => (extraParameters[_.e1] = "string"));
                return Object.keys(pathSpec).map(operationKey => {
                    const method = operationKey.toLowerCase();
                    if (SUPPORTED_SPEC_METHODS.indexOf(method) < 0) {
                        // skip unsupported spec methods
                        return;
                    }
                    const operation = method === "get"
                        ? pathSpec.get
                        : method === "post"
                            ? pathSpec.post
                            : method === "put"
                                ? pathSpec.put
                                : method === "head"
                                    ? pathSpec.head
                                    : method === "delete"
                                        ? pathSpec.delete
                                        : undefined;
                    if (operation === undefined) {
                        console.warn(`Skipping unsupported method [${method}]`);
                        return;
                    }
                    const operationId = operation.operationId;
                    if (operationId === undefined) {
                        console.warn(`Skipping method with missing operationId [${method}]`);
                        return;
                    }
                    return renderOperation(method, operationId, operation, parameters, securityPath, globalAuthHeaders.map(_ => _.e2), extraParameters, defaultSuccessType, defaultErrorType, generateResponseDecoders);
                });
            });
            const operationsImports = new Set();
            const operationTypesCode = operationsTypes
                .map(ops => ops
                .map(op => {
                if (op === undefined) {
                    return;
                }
                op.e2.forEach(i => operationsImports.add(i));
                return op.e1;
            })
                .join("\n"))
                .join("\n");
            const operationsCode = `
      // DO NOT EDIT THIS FILE
      // This file has been generated by gen-api-models
      // tslint:disable:max-union-size
      // tslint:disable:no-identical-functions

      ${generateResponseDecoders ? 'import * as t from "io-ts";' : ""}

      import * as r from "italia-ts-commons/lib/requests";

      ${Array.from(operationsImports.values())
                .map(i => `import { ${i} } from "./${i}";`)
                .join("\n\n")}

      ${operationTypesCode}
    `;
            const prettifiedOperationsCode = prettier.format(operationsCode, {
                parser: "typescript"
            });
            const requestTypesPath = `${definitionsDirPath}/requestTypes.ts`;
            console.log(`Generating request types -> ${requestTypesPath}`);
            yield fs.writeFile(requestTypesPath, prettifiedOperationsCode);
        }
    });
}
exports.generateApi = generateApi;
//
// Configure nunjucks
//
function initNunJucksEnvironment() {
    nunjucks.configure({
        trimBlocks: true
    });
    const env = new nunjucks.Environment(new nunjucks.FileSystemLoader(`${__dirname}/../templates`));
    env.addFilter("contains", (a, item) => {
        return a.indexOf(item) !== -1;
    });
    env.addFilter("startsWith", (a, item) => {
        return a.indexOf(item) === 0;
    });
    env.addFilter("capitalizeFirst", (item) => {
        return `${item[0].toUpperCase()}${item.slice(1)}`;
    });
    env.addFilter("comment", (item) => {
        return "/**\n * " + item.split("\n").join("\n * ") + "\n */";
    });
    env.addFilter("camelCase", (item) => {
        return item.replace(/(\_\w)/g, (m) => {
            return m[1].toUpperCase();
        });
    });
    let imports = {};
    env.addFilter("resetImports", (item) => {
        imports = {};
    });
    env.addFilter("addImport", (item) => {
        imports[item] = true;
    });
    env.addFilter("getImports", (item) => {
        return Object.keys(imports).join("\n");
    });
    let typeAliases = {};
    env.addFilter("resetTypeAliases", (item) => {
        typeAliases = {};
    });
    env.addFilter("addTypeAlias", (item) => {
        typeAliases[item] = true;
    });
    env.addFilter("getTypeAliases", (item) => {
        return Object.keys(typeAliases).join("\n");
    });
    return env;
}
exports.initNunJucksEnvironment = initNunJucksEnvironment;
//# sourceMappingURL=gen-api-models.js.map