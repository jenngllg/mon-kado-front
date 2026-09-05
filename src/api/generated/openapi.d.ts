/**
 * This file was generated from the MonKado OpenAPI contract.
 * Do not edit it manually. Run `pnpm api:types` instead.
 */

export interface paths {
    readonly "/api/v1/auth/email-change-confirmations": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly get?: never;
        readonly put?: never;
        /**
         * Confirms a pending member email change.
         * @description Authorization is provided by the request-specific single-use token and antiforgery validation.
         */
        readonly post: {
            readonly parameters: {
                readonly query?: never;
                readonly header: {
                    /** @description Request token obtained from GET /security/csrf-token. */
                    readonly "X-CSRF-TOKEN": string;
                };
                readonly path?: never;
                readonly cookie?: never;
            };
            /** @description The cancellation token. */
            readonly requestBody: {
                readonly content: {
                    readonly "application/*+json": components["schemas"]["ConfirmMemberEmailChangeRequest"];
                    readonly "application/json": components["schemas"]["ConfirmMemberEmailChangeRequest"];
                };
            };
            readonly responses: {
                /** @description No Content */
                readonly 204: {
                    headers: {
                        /** @description Always no-store for successful responses that delete the refresh cookie. */
                        readonly "Cache-Control"?: string;
                        /** @description Deletes the HttpOnly refresh token cookie for the current browser session. */
                        readonly "Set-Cookie"?: string;
                        readonly [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Bad Request */
                readonly 400: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Conflict */
                readonly 409: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Payload Too Large */
                readonly 413: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Unsupported Media Type */
                readonly 415: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Too Many Requests */
                readonly 429: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Internal server error */
                readonly 500: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description Service Unavailable */
                readonly 503: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
            };
        };
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/auth/email-confirmation-requests": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly get?: never;
        readonly put?: never;
        /** Requests a new account confirmation email. */
        readonly post: {
            readonly parameters: {
                readonly query?: never;
                readonly header: {
                    /** @description Request token obtained from GET /security/csrf-token. */
                    readonly "X-CSRF-TOKEN": string;
                };
                readonly path?: never;
                readonly cookie?: never;
            };
            /** @description The cancellation token. */
            readonly requestBody: {
                readonly content: {
                    readonly "application/*+json": components["schemas"]["RequestEmailConfirmationRequest"];
                    readonly "application/json": components["schemas"]["RequestEmailConfirmationRequest"];
                };
            };
            readonly responses: {
                /** @description Accepted */
                readonly 202: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Bad Request */
                readonly 400: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Payload Too Large */
                readonly 413: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Unsupported Media Type */
                readonly 415: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Too Many Requests */
                readonly 429: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Internal server error */
                readonly 500: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description Service Unavailable */
                readonly 503: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
            };
        };
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/auth/email-confirmations": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly get?: never;
        readonly put?: never;
        /** Confirms an account email address. */
        readonly post: {
            readonly parameters: {
                readonly query?: never;
                readonly header: {
                    /** @description Request token obtained from GET /security/csrf-token. */
                    readonly "X-CSRF-TOKEN": string;
                };
                readonly path?: never;
                readonly cookie?: never;
            };
            /** @description The cancellation token. */
            readonly requestBody: {
                readonly content: {
                    readonly "application/*+json": components["schemas"]["ConfirmEmailRequest"];
                    readonly "application/json": components["schemas"]["ConfirmEmailRequest"];
                };
            };
            readonly responses: {
                /** @description No Content */
                readonly 204: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Bad Request */
                readonly 400: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Payload Too Large */
                readonly 413: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Unsupported Media Type */
                readonly 415: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Too Many Requests */
                readonly 429: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Internal server error */
                readonly 500: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description Service Unavailable */
                readonly 503: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
            };
        };
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/auth/google": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /** Starts Google sign-in with Authorization Code, PKCE, state and nonce. */
        readonly get: {
            readonly parameters: {
                readonly query?: {
                    /** @description Whether the resulting MonKado session should persist for 30 days. */
                    readonly rememberMe?: boolean;
                    /** @description The optional allowlisted relative frontend path. */
                    readonly returnPath?: string;
                };
                readonly header?: never;
                readonly path?: never;
                readonly cookie?: {
                    /** @description HttpOnly rotating refresh token cookie. Production uses __Host-MonKado.Refresh; local development uses MonKado.Refresh. */
                    readonly "__Host-MonKado.Refresh"?: string;
                };
            };
            readonly requestBody?: never;
            readonly responses: {
                /** @description Found */
                readonly 302: {
                    headers: {
                        /** @description Always no-store for this response. */
                        readonly "Cache-Control"?: string;
                        /** @description Redirect destination for the provider challenge or callback completion/failure route. A successful callback completion route includes only an opaque flow binding. It never contains an access token, refresh token or identity claim. */
                        readonly Location?: string;
                        readonly [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Bad Request */
                readonly 400: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Too Many Requests */
                readonly 429: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Internal server error */
                readonly 500: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description Service Unavailable */
                readonly 503: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
            };
        };
        readonly put?: never;
        readonly post?: never;
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/auth/google/callback": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly get?: never;
        readonly put?: never;
        /** Receives Google's form-post callback through the OpenID Connect middleware. */
        readonly post: {
            readonly parameters: {
                readonly query?: never;
                readonly header?: never;
                readonly path?: never;
                readonly cookie?: never;
            };
            /** @description Gets the optional provider error description, which is never exposed or logged. */
            readonly requestBody: {
                readonly content: {
                    readonly "application/x-www-form-urlencoded": {
                        readonly Code?: string;
                        readonly Error?: string;
                        readonly error_description?: string;
                        readonly State?: string;
                    };
                };
            };
            readonly responses: {
                /** @description Found */
                readonly 302: {
                    headers: {
                        /** @description Always no-store for this response. */
                        readonly "Cache-Control"?: string;
                        /** @description Redirect destination for the provider challenge or callback completion/failure route. A successful callback completion route includes only an opaque flow binding. It never contains an access token, refresh token or identity claim. */
                        readonly Location?: string;
                        /** @description Issues a five-minute HttpOnly, Secure, SameSite=Lax and host-only Google external cookie. It contains no Google token, MonKado token or unprotected identity claim. */
                        readonly "Set-Cookie"?: string;
                        readonly [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Payload Too Large */
                readonly 413: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Too Many Requests */
                readonly 429: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Internal server error */
                readonly 500: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
            };
        };
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/auth/google/link": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly get?: never;
        readonly put?: never;
        /** Proves the current MonKado password and explicitly links the validated Google identity. */
        readonly post: {
            readonly parameters: {
                readonly query: {
                    /** @description Opaque five-minute browser-flow binding returned in the frontend redirect fragment. It is required to prevent concurrent Google flows from being crossed and is not an access, refresh or Google token. */
                    readonly flow: string;
                };
                readonly header: {
                    /** @description Request token obtained from GET /security/csrf-token. */
                    readonly "X-CSRF-TOKEN": string;
                };
                readonly path?: never;
                readonly cookie: {
                    /** @description Short-lived Data Protection cookie containing only validated Google identity claims and protected flow state. It is HttpOnly, Secure, SameSite=Lax, host-only and expires after five minutes. Local development uses MonKado.GoogleExternal. It never contains Google or MonKado tokens. */
                    readonly "__Host-MonKado.GoogleExternal": string;
                };
            };
            /** @description The cancellation token. */
            readonly requestBody: {
                readonly content: {
                    readonly "application/*+json": components["schemas"]["LinkGoogleAccountRequest"];
                    readonly "application/json": components["schemas"]["LinkGoogleAccountRequest"];
                };
            };
            readonly responses: {
                /** @description OK */
                readonly 200: {
                    headers: {
                        /** @description Always no-store for this response. */
                        readonly "Cache-Control"?: string;
                        /** @description Rotating refresh token cookie. It is HttpOnly, SameSite=Strict, host-only, and uses Path=/. Production uses the Secure __Host-MonKado.Refresh name; local development uses MonKado.Refresh. It is a browser-session cookie unless rememberMe requests the fixed 30-day expiration. */
                        readonly "Set-Cookie"?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["AccessTokenResponse"];
                    };
                };
                /** @description Bad Request */
                readonly 400: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Unauthorized */
                readonly 401: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Conflict */
                readonly 409: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Payload Too Large */
                readonly 413: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Unsupported Media Type */
                readonly 415: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Too Many Requests */
                readonly 429: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Internal server error */
                readonly 500: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description Service Unavailable */
                readonly 503: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
            };
        };
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/auth/password-reset-requests": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly get?: never;
        readonly put?: never;
        /** Requests an account password reset email. */
        readonly post: {
            readonly parameters: {
                readonly query?: never;
                readonly header: {
                    /** @description Request token obtained from GET /security/csrf-token. */
                    readonly "X-CSRF-TOKEN": string;
                };
                readonly path?: never;
                readonly cookie?: never;
            };
            /** @description The cancellation token. */
            readonly requestBody: {
                readonly content: {
                    readonly "application/*+json": components["schemas"]["RequestPasswordResetRequest"];
                    readonly "application/json": components["schemas"]["RequestPasswordResetRequest"];
                };
            };
            readonly responses: {
                /** @description Accepted */
                readonly 202: {
                    headers: {
                        /** @description Always no-store for this response. */
                        readonly "Cache-Control"?: string;
                        readonly [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Bad Request */
                readonly 400: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Payload Too Large */
                readonly 413: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Unsupported Media Type */
                readonly 415: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Too Many Requests */
                readonly 429: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Internal server error */
                readonly 500: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description Service Unavailable */
                readonly 503: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
            };
        };
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/auth/password-resets": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly get?: never;
        readonly put?: never;
        /** Resets an account password using a password reset link. */
        readonly post: {
            readonly parameters: {
                readonly query?: never;
                readonly header: {
                    /** @description Request token obtained from GET /security/csrf-token. */
                    readonly "X-CSRF-TOKEN": string;
                };
                readonly path?: never;
                readonly cookie?: never;
            };
            /** @description The cancellation token. */
            readonly requestBody: {
                readonly content: {
                    readonly "application/*+json": components["schemas"]["ResetPasswordRequest"];
                    readonly "application/json": components["schemas"]["ResetPasswordRequest"];
                };
            };
            readonly responses: {
                /** @description No Content */
                readonly 204: {
                    headers: {
                        /** @description Always no-store for this response. */
                        readonly "Cache-Control"?: string;
                        /** @description Deletes the HttpOnly refresh token cookie for the current browser session. */
                        readonly "Set-Cookie"?: string;
                        readonly [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Bad Request */
                readonly 400: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Payload Too Large */
                readonly 413: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Unsupported Media Type */
                readonly 415: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Too Many Requests */
                readonly 429: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Internal server error */
                readonly 500: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description Service Unavailable */
                readonly 503: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
            };
        };
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/auth/registrations": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly get?: never;
        readonly put?: never;
        /** Registers an account and schedules its confirmation email. */
        readonly post: {
            readonly parameters: {
                readonly query?: never;
                readonly header: {
                    /** @description Request token obtained from GET /security/csrf-token. */
                    readonly "X-CSRF-TOKEN": string;
                };
                readonly path?: never;
                readonly cookie?: never;
            };
            /** @description The cancellation token. */
            readonly requestBody: {
                readonly content: {
                    readonly "application/*+json": components["schemas"]["RegisterAccountRequest"];
                    readonly "application/json": components["schemas"]["RegisterAccountRequest"];
                };
            };
            readonly responses: {
                /** @description Accepted */
                readonly 202: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Bad Request */
                readonly 400: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Payload Too Large */
                readonly 413: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Unsupported Media Type */
                readonly 415: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Too Many Requests */
                readonly 429: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Internal server error */
                readonly 500: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description Service Unavailable */
                readonly 503: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
            };
        };
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/auth/sessions": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly get?: never;
        readonly put?: never;
        /** Authenticates an account and creates its server-side session. */
        readonly post: {
            readonly parameters: {
                readonly query?: never;
                readonly header: {
                    /** @description Request token obtained from GET /security/csrf-token. */
                    readonly "X-CSRF-TOKEN": string;
                };
                readonly path?: never;
                readonly cookie?: {
                    /** @description HttpOnly rotating refresh token cookie. Production uses __Host-MonKado.Refresh; local development uses MonKado.Refresh. */
                    readonly "__Host-MonKado.Refresh"?: string;
                };
            };
            /** @description The cancellation token. */
            readonly requestBody: {
                readonly content: {
                    readonly "application/*+json": components["schemas"]["LoginRequest"];
                    readonly "application/json": components["schemas"]["LoginRequest"];
                };
            };
            readonly responses: {
                /** @description OK */
                readonly 200: {
                    headers: {
                        /** @description Always no-store for token responses. */
                        readonly "Cache-Control"?: string;
                        /** @description Rotating refresh token cookie. It is HttpOnly, SameSite=Strict, host-only, and uses Path=/. Production uses the Secure __Host-MonKado.Refresh name; local development uses MonKado.Refresh. It is a browser-session cookie unless rememberMe requests the fixed 30-day expiration. */
                        readonly "Set-Cookie"?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["AccessTokenResponse"];
                    };
                };
                /** @description Bad Request */
                readonly 400: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Unauthorized */
                readonly 401: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Payload Too Large */
                readonly 413: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Unsupported Media Type */
                readonly 415: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Too Many Requests */
                readonly 429: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Internal server error */
                readonly 500: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description Service Unavailable */
                readonly 503: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
            };
        };
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/auth/sessions/current": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /** Gets the current authenticated member session from persistence. */
        readonly get: {
            readonly parameters: {
                readonly query?: never;
                readonly header?: never;
                readonly path?: never;
                readonly cookie?: never;
            };
            readonly requestBody?: never;
            readonly responses: {
                /** @description OK */
                readonly 200: {
                    headers: {
                        /** @description Strong entity tag representing the current resource version. */
                        readonly ETag?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["CurrentSessionResponse"];
                    };
                };
                /** @description Authentication is required */
                readonly 401: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description The authenticated user is not authorized */
                readonly 403: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description Internal server error */
                readonly 500: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description Service Unavailable */
                readonly 503: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
            };
        };
        readonly put?: never;
        readonly post?: never;
        /** Ends the current browser refresh session. */
        readonly delete: {
            readonly parameters: {
                readonly query?: never;
                readonly header: {
                    /** @description Request token obtained from GET /security/csrf-token. */
                    readonly "X-CSRF-TOKEN": string;
                };
                readonly path?: never;
                readonly cookie?: {
                    /** @description HttpOnly rotating refresh token cookie. Production uses __Host-MonKado.Refresh; local development uses MonKado.Refresh. */
                    readonly "__Host-MonKado.Refresh"?: string;
                };
            };
            readonly requestBody?: never;
            readonly responses: {
                /** @description No Content */
                readonly 204: {
                    headers: {
                        /** @description Always no-store for successful responses that delete the refresh cookie. */
                        readonly "Cache-Control"?: string;
                        /** @description Deletes the HttpOnly refresh token cookie for the current browser session. */
                        readonly "Set-Cookie"?: string;
                        readonly [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Bad Request */
                readonly 400: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Too Many Requests */
                readonly 429: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Internal server error */
                readonly 500: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description Service Unavailable */
                readonly 503: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
            };
        };
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/auth/sessions/refresh": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly get?: never;
        readonly put?: never;
        /** Rotates the current refresh session and issues a new access token. */
        readonly post: {
            readonly parameters: {
                readonly query?: never;
                readonly header: {
                    /** @description Request token obtained from GET /security/csrf-token. */
                    readonly "X-CSRF-TOKEN": string;
                };
                readonly path?: never;
                readonly cookie: {
                    /** @description HttpOnly rotating refresh token cookie. Production uses __Host-MonKado.Refresh; local development uses MonKado.Refresh. */
                    readonly "__Host-MonKado.Refresh": string;
                };
            };
            readonly requestBody?: never;
            readonly responses: {
                /** @description OK */
                readonly 200: {
                    headers: {
                        /** @description Always no-store for token responses. */
                        readonly "Cache-Control"?: string;
                        /** @description Rotating refresh token cookie. It is HttpOnly, SameSite=Strict, host-only, and uses Path=/. Production uses the Secure __Host-MonKado.Refresh name; local development uses MonKado.Refresh. It is a browser-session cookie unless rememberMe requests the fixed 30-day expiration. */
                        readonly "Set-Cookie"?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["AccessTokenResponse"];
                    };
                };
                /** @description Bad Request */
                readonly 400: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Unauthorized */
                readonly 401: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Too Many Requests */
                readonly 429: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Internal server error */
                readonly 500: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description Service Unavailable */
                readonly 503: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
            };
        };
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/members/current/email": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly get?: never;
        /** Requests a change to the current authenticated member email address. */
        readonly put: {
            readonly parameters: {
                readonly query?: never;
                readonly header: {
                    /** @description Strong entity tag returned when the resource was retrieved or last modified. */
                    readonly "If-Match": string;
                };
                readonly path?: never;
                readonly cookie?: never;
            };
            /** @description The cancellation token. */
            readonly requestBody: {
                readonly content: {
                    readonly "application/*+json": components["schemas"]["UpdateMemberEmailRequest"];
                    readonly "application/json": components["schemas"]["UpdateMemberEmailRequest"];
                };
            };
            readonly responses: {
                /** @description Accepted */
                readonly 202: {
                    headers: {
                        /** @description Always no-store for this response. */
                        readonly "Cache-Control"?: string;
                        readonly [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Bad Request */
                readonly 400: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Authentication is required */
                readonly 401: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description The authenticated user is not authorized */
                readonly 403: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description Conflict */
                readonly 409: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Precondition Failed */
                readonly 412: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Payload Too Large */
                readonly 413: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Unsupported Media Type */
                readonly 415: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Precondition Required */
                readonly 428: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Too Many Requests */
                readonly 429: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Internal server error */
                readonly 500: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description Service Unavailable */
                readonly 503: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
            };
        };
        readonly post?: never;
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/members/current/password": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly get?: never;
        /** Changes the password of the current authenticated member. */
        readonly put: {
            readonly parameters: {
                readonly query?: never;
                readonly header?: never;
                readonly path?: never;
                readonly cookie?: never;
            };
            /** @description The cancellation token. */
            readonly requestBody: {
                readonly content: {
                    readonly "application/*+json": components["schemas"]["UpdateMemberPasswordRequest"];
                    readonly "application/json": components["schemas"]["UpdateMemberPasswordRequest"];
                };
            };
            readonly responses: {
                /** @description No Content */
                readonly 204: {
                    headers: {
                        /** @description Always no-store for successful responses that delete the refresh cookie. */
                        readonly "Cache-Control"?: string;
                        /** @description Deletes the HttpOnly refresh token cookie for the current browser session. */
                        readonly "Set-Cookie"?: string;
                        readonly [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Bad Request */
                readonly 400: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Authentication is required */
                readonly 401: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description The authenticated user is not authorized */
                readonly 403: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description Payload Too Large */
                readonly 413: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Unsupported Media Type */
                readonly 415: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Too Many Requests */
                readonly 429: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Internal server error */
                readonly 500: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description Service Unavailable */
                readonly 503: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
            };
        };
        readonly post?: never;
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/members/current/profile": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly get?: never;
        /** Updates the display name of the current authenticated member. */
        readonly put: {
            readonly parameters: {
                readonly query?: never;
                readonly header: {
                    /** @description Strong entity tag returned when the resource was retrieved or last modified. */
                    readonly "If-Match": string;
                };
                readonly path?: never;
                readonly cookie?: never;
            };
            /** @description The cancellation token. */
            readonly requestBody: {
                readonly content: {
                    readonly "application/*+json": components["schemas"]["UpdateMemberProfileRequest"];
                    readonly "application/json": components["schemas"]["UpdateMemberProfileRequest"];
                };
            };
            readonly responses: {
                /** @description OK */
                readonly 200: {
                    headers: {
                        /** @description Strong entity tag representing the current resource version. */
                        readonly ETag?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["MemberProfileResponse"];
                    };
                };
                /** @description Bad Request */
                readonly 400: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Authentication is required */
                readonly 401: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description The authenticated user is not authorized */
                readonly 403: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description Precondition Failed */
                readonly 412: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Payload Too Large */
                readonly 413: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Unsupported Media Type */
                readonly 415: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Precondition Required */
                readonly 428: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Internal server error */
                readonly 500: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description Service Unavailable */
                readonly 503: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
            };
        };
        readonly post?: never;
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/members/current/reservations": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /** Gets one page of the current member's reservation history. */
        readonly get: {
            readonly parameters: {
                readonly query?: {
                    /** @description The optional one-based page number. The default is 1. */
                    readonly page?: number | string;
                    /** @description The optional page size. The default is 20 and the maximum is 100. */
                    readonly pageSize?: number | string;
                    /** @description The optional status filter: active, cancelled or unavailable. */
                    readonly status?: string;
                };
                readonly header?: never;
                readonly path?: never;
                readonly cookie?: never;
            };
            readonly requestBody?: never;
            readonly responses: {
                /** @description OK */
                readonly 200: {
                    headers: {
                        /** @description Always no-store for this response. */
                        readonly "Cache-Control"?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["PaginatedResponseOfGiftReservationHistoryResponse"];
                    };
                };
                /** @description Bad Request */
                readonly 400: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Authentication is required */
                readonly 401: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description The authenticated user is not authorized */
                readonly 403: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description Internal server error */
                readonly 500: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description Service Unavailable */
                readonly 503: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
            };
        };
        readonly put?: never;
        readonly post?: never;
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/shared-wishlists/{shareLinkId}": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /** Gets a wishlist through its active share link. */
        readonly get: {
            readonly parameters: {
                readonly query?: {
                    /** @description Whether to return only gifts available to the current participant. */
                    readonly availableOnly?: boolean;
                };
                readonly header?: {
                    readonly "X-MonKado-Share-Token"?: string;
                };
                readonly path: {
                    /** @description The public share-link identifier. */
                    readonly shareLinkId: string;
                };
                readonly cookie?: {
                    /** @description Persistent opaque guest-session cookie. Production uses __Host-MonKado.Guest; local development uses MonKado.Guest. */
                    readonly "__Host-MonKado.Guest"?: string;
                };
            };
            readonly requestBody?: never;
            readonly responses: {
                /** @description OK */
                readonly 200: {
                    headers: {
                        /** @description Always no-store for this response. */
                        readonly "Cache-Control"?: string;
                        /** @description Prevents indexing and archiving of shared-wishlist responses. */
                        readonly "X-Robots-Tag"?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["SharedWishlistResponse"];
                    };
                };
                /** @description Bad Request */
                readonly 400: {
                    headers: {
                        /** @description Prevents indexing and archiving of shared-wishlist responses. */
                        readonly "X-Robots-Tag"?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Unauthorized */
                readonly 401: {
                    headers: {
                        /** @description Prevents indexing and archiving of shared-wishlist responses. */
                        readonly "X-Robots-Tag"?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Not Found */
                readonly 404: {
                    headers: {
                        /** @description Prevents indexing and archiving of shared-wishlist responses. */
                        readonly "X-Robots-Tag"?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Too Many Requests */
                readonly 429: {
                    headers: {
                        /** @description Prevents indexing and archiving of shared-wishlist responses. */
                        readonly "X-Robots-Tag"?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Internal server error */
                readonly 500: {
                    headers: {
                        /** @description Prevents indexing and archiving of shared-wishlist responses. */
                        readonly "X-Robots-Tag"?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description Service Unavailable */
                readonly 503: {
                    headers: {
                        /** @description Prevents indexing and archiving of shared-wishlist responses. */
                        readonly "X-Robots-Tag"?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
            };
        };
        readonly put?: never;
        readonly post?: never;
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/shared-wishlists/{shareLinkId}/participants": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly get?: never;
        readonly put?: never;
        /** Joins a wishlist through its active share link. */
        readonly post: {
            readonly parameters: {
                readonly query?: never;
                readonly header: {
                    /** @description Request token obtained from GET /security/csrf-token. */
                    readonly "X-CSRF-TOKEN": string;
                    readonly "X-MonKado-Share-Token"?: string;
                };
                readonly path: {
                    /** @description The public share-link identifier. */
                    readonly shareLinkId: string;
                };
                readonly cookie?: {
                    /** @description Persistent opaque guest-session cookie. Production uses __Host-MonKado.Guest; local development uses MonKado.Guest. */
                    readonly "__Host-MonKado.Guest"?: string;
                };
            };
            /** @description The cancellation token. */
            readonly requestBody?: {
                readonly content: {
                    readonly "application/*+json": null | components["schemas"]["JoinSharedWishlistRequest"];
                    readonly "application/json": null | components["schemas"]["JoinSharedWishlistRequest"];
                };
            };
            readonly responses: {
                /** @description OK */
                readonly 200: {
                    headers: {
                        /** @description Always no-store for this response. */
                        readonly "Cache-Control"?: string;
                        /** @description Prevents indexing and archiving of shared-wishlist responses. */
                        readonly "X-Robots-Tag"?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["WishlistParticipantResponse"];
                    };
                };
                /** @description Created */
                readonly 201: {
                    headers: {
                        /** @description Always no-store for this response. */
                        readonly "Cache-Control"?: string;
                        /** @description URL of the created resource. */
                        readonly Location?: string;
                        /** @description Issues an HttpOnly, SameSite=Strict, host-only guest-session cookie for the configured lifetime, which cannot exceed 180 days. Production cookies are Secure and use the __Host- prefix. */
                        readonly "Set-Cookie"?: string;
                        /** @description Prevents indexing and archiving of shared-wishlist responses. */
                        readonly "X-Robots-Tag"?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["WishlistParticipantResponse"];
                    };
                };
                /** @description Bad Request */
                readonly 400: {
                    headers: {
                        /** @description Prevents indexing and archiving of shared-wishlist responses. */
                        readonly "X-Robots-Tag"?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Unauthorized */
                readonly 401: {
                    headers: {
                        /** @description Prevents indexing and archiving of shared-wishlist responses. */
                        readonly "X-Robots-Tag"?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Not Found */
                readonly 404: {
                    headers: {
                        /** @description Prevents indexing and archiving of shared-wishlist responses. */
                        readonly "X-Robots-Tag"?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Conflict */
                readonly 409: {
                    headers: {
                        /** @description Prevents indexing and archiving of shared-wishlist responses. */
                        readonly "X-Robots-Tag"?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Payload Too Large */
                readonly 413: {
                    headers: {
                        /** @description Prevents indexing and archiving of shared-wishlist responses. */
                        readonly "X-Robots-Tag"?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Unsupported Media Type */
                readonly 415: {
                    headers: {
                        /** @description Prevents indexing and archiving of shared-wishlist responses. */
                        readonly "X-Robots-Tag"?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Too Many Requests */
                readonly 429: {
                    headers: {
                        /** @description Prevents indexing and archiving of shared-wishlist responses. */
                        readonly "X-Robots-Tag"?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Internal server error */
                readonly 500: {
                    headers: {
                        /** @description Prevents indexing and archiving of shared-wishlist responses. */
                        readonly "X-Robots-Tag"?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description Service Unavailable */
                readonly 503: {
                    headers: {
                        /** @description Prevents indexing and archiving of shared-wishlist responses. */
                        readonly "X-Robots-Tag"?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
            };
        };
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/shared-wishlists/{shareLinkId}/participants/current": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /** Gets the participant associated with the current caller. */
        readonly get: operations["GetCurrentSharedWishlistParticipant"];
        readonly put?: never;
        readonly post?: never;
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/shared-wishlists/{shareLinkId}/reports": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly get?: never;
        readonly put?: never;
        /** Reports a wishlist through its active share link. */
        readonly post: {
            readonly parameters: {
                readonly query?: never;
                readonly header: {
                    /** @description Request token obtained from GET /security/csrf-token. */
                    readonly "X-CSRF-TOKEN": string;
                    readonly "X-MonKado-Share-Token"?: string;
                };
                readonly path: {
                    /** @description The public share-link identifier. */
                    readonly shareLinkId: string;
                };
                readonly cookie?: never;
            };
            /** @description The cancellation token. */
            readonly requestBody: {
                readonly content: {
                    readonly "application/*+json": components["schemas"]["ReportSharedWishlistRequest"];
                    readonly "application/json": components["schemas"]["ReportSharedWishlistRequest"];
                };
            };
            readonly responses: {
                /** @description No Content */
                readonly 204: {
                    headers: {
                        /** @description Always no-store for this response. */
                        readonly "Cache-Control"?: string;
                        /** @description Prevents indexing and archiving of shared-wishlist responses. */
                        readonly "X-Robots-Tag"?: string;
                        readonly [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Bad Request */
                readonly 400: {
                    headers: {
                        /** @description Prevents indexing and archiving of shared-wishlist responses. */
                        readonly "X-Robots-Tag"?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Not Found */
                readonly 404: {
                    headers: {
                        /** @description Prevents indexing and archiving of shared-wishlist responses. */
                        readonly "X-Robots-Tag"?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Payload Too Large */
                readonly 413: {
                    headers: {
                        /** @description Prevents indexing and archiving of shared-wishlist responses. */
                        readonly "X-Robots-Tag"?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Unsupported Media Type */
                readonly 415: {
                    headers: {
                        /** @description Prevents indexing and archiving of shared-wishlist responses. */
                        readonly "X-Robots-Tag"?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Too Many Requests */
                readonly 429: {
                    headers: {
                        /** @description Prevents indexing and archiving of shared-wishlist responses. */
                        readonly "X-Robots-Tag"?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Internal server error */
                readonly 500: {
                    headers: {
                        /** @description Prevents indexing and archiving of shared-wishlist responses. */
                        readonly "X-Robots-Tag"?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description Service Unavailable */
                readonly 503: {
                    headers: {
                        /** @description Prevents indexing and archiving of shared-wishlist responses. */
                        readonly "X-Robots-Tag"?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
            };
        };
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/shared-wishlists/{shareLinkId}/wishes/{wishId}": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /** Gets detailed information about one gift wish through an active share link. */
        readonly get: {
            readonly parameters: {
                readonly query?: never;
                readonly header?: {
                    readonly "X-MonKado-Share-Token"?: string;
                };
                readonly path: {
                    /** @description The public share-link identifier. */
                    readonly shareLinkId: string;
                    /** @description The gift-wish identifier. */
                    readonly wishId: string;
                };
                readonly cookie?: {
                    /** @description Persistent opaque guest-session cookie. Production uses __Host-MonKado.Guest; local development uses MonKado.Guest. */
                    readonly "__Host-MonKado.Guest"?: string;
                };
            };
            readonly requestBody?: never;
            readonly responses: {
                /** @description OK */
                readonly 200: {
                    headers: {
                        /** @description Always no-store for this response. */
                        readonly "Cache-Control"?: string;
                        /** @description Prevents indexing and archiving of shared-wishlist responses. */
                        readonly "X-Robots-Tag"?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["SharedWishDetailResponse"];
                    };
                };
                /** @description Bad Request */
                readonly 400: {
                    headers: {
                        /** @description Prevents indexing and archiving of shared-wishlist responses. */
                        readonly "X-Robots-Tag"?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Unauthorized */
                readonly 401: {
                    headers: {
                        /** @description Prevents indexing and archiving of shared-wishlist responses. */
                        readonly "X-Robots-Tag"?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Not Found */
                readonly 404: {
                    headers: {
                        /** @description Prevents indexing and archiving of shared-wishlist responses. */
                        readonly "X-Robots-Tag"?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Too Many Requests */
                readonly 429: {
                    headers: {
                        /** @description Prevents indexing and archiving of shared-wishlist responses. */
                        readonly "X-Robots-Tag"?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Internal server error */
                readonly 500: {
                    headers: {
                        /** @description Prevents indexing and archiving of shared-wishlist responses. */
                        readonly "X-Robots-Tag"?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description Service Unavailable */
                readonly 503: {
                    headers: {
                        /** @description Prevents indexing and archiving of shared-wishlist responses. */
                        readonly "X-Robots-Tag"?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
            };
        };
        readonly put?: never;
        readonly post?: never;
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/shared-wishlists/{shareLinkId}/wishes/{wishId}/reservations/current": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /** Gets the current participant's reservation for one shared gift. */
        readonly get: operations["GetCurrentSharedWishlistGiftReservation"];
        /** Creates or replaces the current participant's reservation for one shared gift. */
        readonly put: {
            readonly parameters: {
                readonly query?: never;
                readonly header: {
                    readonly "If-Match"?: string;
                    /** @description Request token obtained from GET /security/csrf-token. */
                    readonly "X-CSRF-TOKEN": string;
                    readonly "X-MonKado-Share-Token"?: string;
                };
                readonly path: {
                    /** @description The public share-link identifier. */
                    readonly shareLinkId: string;
                    /** @description The gift-wish identifier. */
                    readonly wishId: string;
                };
                readonly cookie?: {
                    /** @description Persistent opaque guest-session cookie. Production uses __Host-MonKado.Guest; local development uses MonKado.Guest. */
                    readonly "__Host-MonKado.Guest"?: string;
                };
            };
            /** @description The cancellation token. */
            readonly requestBody: {
                readonly content: {
                    readonly "application/*+json": components["schemas"]["UpsertGiftReservationRequest"];
                    readonly "application/json": components["schemas"]["UpsertGiftReservationRequest"];
                };
            };
            readonly responses: {
                /** @description OK */
                readonly 200: {
                    headers: {
                        /** @description Always no-store for this response. */
                        readonly "Cache-Control"?: string;
                        /** @description Strong entity tag representing the current resource version. */
                        readonly ETag?: string;
                        /** @description Prevents indexing and archiving of shared-wishlist responses. */
                        readonly "X-Robots-Tag"?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["GiftReservationResponse"];
                    };
                };
                /** @description Created */
                readonly 201: {
                    headers: {
                        /** @description Always no-store for this response. */
                        readonly "Cache-Control"?: string;
                        /** @description Strong entity tag representing the current resource version. */
                        readonly ETag?: string;
                        /** @description URL of the created resource. */
                        readonly Location?: string;
                        /** @description Prevents indexing and archiving of shared-wishlist responses. */
                        readonly "X-Robots-Tag"?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["GiftReservationResponse"];
                    };
                };
                /** @description Bad Request */
                readonly 400: {
                    headers: {
                        /** @description Prevents indexing and archiving of shared-wishlist responses. */
                        readonly "X-Robots-Tag"?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Unauthorized */
                readonly 401: {
                    headers: {
                        /** @description Prevents indexing and archiving of shared-wishlist responses. */
                        readonly "X-Robots-Tag"?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Not Found */
                readonly 404: {
                    headers: {
                        /** @description Prevents indexing and archiving of shared-wishlist responses. */
                        readonly "X-Robots-Tag"?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Conflict */
                readonly 409: {
                    headers: {
                        /** @description Prevents indexing and archiving of shared-wishlist responses. */
                        readonly "X-Robots-Tag"?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Precondition Failed */
                readonly 412: {
                    headers: {
                        /** @description Prevents indexing and archiving of shared-wishlist responses. */
                        readonly "X-Robots-Tag"?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Payload Too Large */
                readonly 413: {
                    headers: {
                        /** @description Prevents indexing and archiving of shared-wishlist responses. */
                        readonly "X-Robots-Tag"?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Unsupported Media Type */
                readonly 415: {
                    headers: {
                        /** @description Prevents indexing and archiving of shared-wishlist responses. */
                        readonly "X-Robots-Tag"?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Precondition Required */
                readonly 428: {
                    headers: {
                        /** @description Prevents indexing and archiving of shared-wishlist responses. */
                        readonly "X-Robots-Tag"?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Too Many Requests */
                readonly 429: {
                    headers: {
                        /** @description Prevents indexing and archiving of shared-wishlist responses. */
                        readonly "X-Robots-Tag"?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Internal server error */
                readonly 500: {
                    headers: {
                        /** @description Prevents indexing and archiving of shared-wishlist responses. */
                        readonly "X-Robots-Tag"?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description Service Unavailable */
                readonly 503: {
                    headers: {
                        /** @description Prevents indexing and archiving of shared-wishlist responses. */
                        readonly "X-Robots-Tag"?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
            };
        };
        readonly post?: never;
        /** Cancels the current participant's reservation for one shared gift. */
        readonly delete: {
            readonly parameters: {
                readonly query?: never;
                readonly header: {
                    /** @description Strong entity tag returned when the resource was retrieved or last modified. */
                    readonly "If-Match": string;
                    /** @description Request token obtained from GET /security/csrf-token. */
                    readonly "X-CSRF-TOKEN": string;
                    readonly "X-MonKado-Share-Token"?: string;
                };
                readonly path: {
                    /** @description The public share-link identifier. */
                    readonly shareLinkId: string;
                    /** @description The gift-wish identifier. */
                    readonly wishId: string;
                };
                readonly cookie?: {
                    /** @description Persistent opaque guest-session cookie. Production uses __Host-MonKado.Guest; local development uses MonKado.Guest. */
                    readonly "__Host-MonKado.Guest"?: string;
                };
            };
            readonly requestBody?: never;
            readonly responses: {
                /** @description No Content */
                readonly 204: {
                    headers: {
                        /** @description Always no-store for this response. */
                        readonly "Cache-Control"?: string;
                        /** @description Prevents indexing and archiving of shared-wishlist responses. */
                        readonly "X-Robots-Tag"?: string;
                        readonly [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Bad Request */
                readonly 400: {
                    headers: {
                        /** @description Prevents indexing and archiving of shared-wishlist responses. */
                        readonly "X-Robots-Tag"?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Unauthorized */
                readonly 401: {
                    headers: {
                        /** @description Prevents indexing and archiving of shared-wishlist responses. */
                        readonly "X-Robots-Tag"?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Not Found */
                readonly 404: {
                    headers: {
                        /** @description Prevents indexing and archiving of shared-wishlist responses. */
                        readonly "X-Robots-Tag"?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Precondition Failed */
                readonly 412: {
                    headers: {
                        /** @description Prevents indexing and archiving of shared-wishlist responses. */
                        readonly "X-Robots-Tag"?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Precondition Required */
                readonly 428: {
                    headers: {
                        /** @description Prevents indexing and archiving of shared-wishlist responses. */
                        readonly "X-Robots-Tag"?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Too Many Requests */
                readonly 429: {
                    headers: {
                        /** @description Prevents indexing and archiving of shared-wishlist responses. */
                        readonly "X-Robots-Tag"?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Internal server error */
                readonly 500: {
                    headers: {
                        /** @description Prevents indexing and archiving of shared-wishlist responses. */
                        readonly "X-Robots-Tag"?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description Service Unavailable */
                readonly 503: {
                    headers: {
                        /** @description Prevents indexing and archiving of shared-wishlist responses. */
                        readonly "X-Robots-Tag"?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
            };
        };
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/wishlists": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /** Gets all private wishlists owned by the current member. */
        readonly get: {
            readonly parameters: {
                readonly query?: never;
                readonly header?: never;
                readonly path?: never;
                readonly cookie?: never;
            };
            readonly requestBody?: never;
            readonly responses: {
                /** @description OK */
                readonly 200: {
                    headers: {
                        /** @description Always no-store for this response. */
                        readonly "Cache-Control"?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": readonly components["schemas"]["WishlistResponse"][];
                    };
                };
                /** @description Authentication is required */
                readonly 401: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description The authenticated user is not authorized */
                readonly 403: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description Internal server error */
                readonly 500: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description Service Unavailable */
                readonly 503: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
            };
        };
        readonly put?: never;
        /** Creates a private wishlist for the current member. */
        readonly post: {
            readonly parameters: {
                readonly query?: never;
                readonly header?: never;
                readonly path?: never;
                readonly cookie?: never;
            };
            /** @description The cancellation token. */
            readonly requestBody: {
                readonly content: {
                    readonly "application/*+json": components["schemas"]["CreateWishlistRequest"];
                    readonly "application/json": components["schemas"]["CreateWishlistRequest"];
                };
            };
            readonly responses: {
                /** @description Created */
                readonly 201: {
                    headers: {
                        /** @description Always no-store for this response. */
                        readonly "Cache-Control"?: string;
                        /** @description Strong entity tag representing the current resource version. */
                        readonly ETag?: string;
                        /** @description URL of the created resource. */
                        readonly Location?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["WishlistResponse"];
                    };
                };
                /** @description Bad Request */
                readonly 400: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Authentication is required */
                readonly 401: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description The authenticated user is not authorized */
                readonly 403: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description Conflict */
                readonly 409: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Payload Too Large */
                readonly 413: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Unsupported Media Type */
                readonly 415: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Internal server error */
                readonly 500: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description Service Unavailable */
                readonly 503: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
            };
        };
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/wishlists/{wishlistId}": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /** Gets a private wishlist owned by the current member. */
        readonly get: operations["GetWishlist"];
        /** Updates a private wishlist owned by the current member. */
        readonly put: {
            readonly parameters: {
                readonly query?: never;
                readonly header: {
                    /** @description Strong entity tag returned when the resource was retrieved or last modified. */
                    readonly "If-Match": string;
                };
                readonly path: {
                    /** @description The wishlist identifier. */
                    readonly wishlistId: string;
                };
                readonly cookie?: never;
            };
            /** @description The cancellation token. */
            readonly requestBody: {
                readonly content: {
                    readonly "application/*+json": components["schemas"]["UpdateWishlistRequest"];
                    readonly "application/json": components["schemas"]["UpdateWishlistRequest"];
                };
            };
            readonly responses: {
                /** @description OK */
                readonly 200: {
                    headers: {
                        /** @description Always no-store for this response. */
                        readonly "Cache-Control"?: string;
                        /** @description Strong entity tag representing the current resource version. */
                        readonly ETag?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["WishlistResponse"];
                    };
                };
                /** @description Bad Request */
                readonly 400: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Authentication is required */
                readonly 401: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description The authenticated user is not authorized */
                readonly 403: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description Not Found */
                readonly 404: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Conflict */
                readonly 409: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Precondition Failed */
                readonly 412: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Payload Too Large */
                readonly 413: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Unsupported Media Type */
                readonly 415: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Precondition Required */
                readonly 428: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Internal server error */
                readonly 500: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description Service Unavailable */
                readonly 503: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
            };
        };
        readonly post?: never;
        /** Deletes a private wishlist owned by the current member. */
        readonly delete: {
            readonly parameters: {
                readonly query?: never;
                readonly header: {
                    /** @description Strong entity tag returned when the resource was retrieved or last modified. */
                    readonly "If-Match": string;
                };
                readonly path: {
                    /** @description The wishlist identifier. */
                    readonly wishlistId: string;
                };
                readonly cookie?: never;
            };
            readonly requestBody?: never;
            readonly responses: {
                /** @description No Content */
                readonly 204: {
                    headers: {
                        /** @description Always no-store for this response. */
                        readonly "Cache-Control"?: string;
                        readonly [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Bad Request */
                readonly 400: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Authentication is required */
                readonly 401: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description The authenticated user is not authorized */
                readonly 403: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description Not Found */
                readonly 404: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Precondition Failed */
                readonly 412: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Precondition Required */
                readonly 428: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Internal server error */
                readonly 500: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description Service Unavailable */
                readonly 503: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
            };
        };
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/wishlists/{wishlistId}/share-link": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /** Gets the active share link of an owned wishlist. */
        readonly get: operations["GetWishlistShareLink"];
        /** Regenerates the active share-link secret. */
        readonly put: {
            readonly parameters: {
                readonly query?: never;
                readonly header: {
                    /** @description Strong entity tag returned when the resource was retrieved or last modified. */
                    readonly "If-Match": string;
                };
                readonly path: {
                    /** @description The wishlist identifier. */
                    readonly wishlistId: string;
                };
                readonly cookie?: never;
            };
            readonly requestBody?: never;
            readonly responses: {
                /** @description OK */
                readonly 200: {
                    headers: {
                        /** @description Always no-store for this response. */
                        readonly "Cache-Control"?: string;
                        /** @description Strong entity tag representing the current resource version. */
                        readonly ETag?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["WishlistShareLinkResponse"];
                    };
                };
                /** @description Bad Request */
                readonly 400: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Authentication is required */
                readonly 401: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description The authenticated user is not authorized */
                readonly 403: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description Not Found */
                readonly 404: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Precondition Failed */
                readonly 412: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Precondition Required */
                readonly 428: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Internal server error */
                readonly 500: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description Service Unavailable */
                readonly 503: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
            };
        };
        /** Creates the active share link of an owned wishlist. */
        readonly post: {
            readonly parameters: {
                readonly query?: never;
                readonly header?: never;
                readonly path: {
                    /** @description The wishlist identifier. */
                    readonly wishlistId: string;
                };
                readonly cookie?: never;
            };
            readonly requestBody?: never;
            readonly responses: {
                /** @description Created */
                readonly 201: {
                    headers: {
                        /** @description Always no-store for this response. */
                        readonly "Cache-Control"?: string;
                        /** @description Strong entity tag representing the current resource version. */
                        readonly ETag?: string;
                        /** @description URL of the created resource. */
                        readonly Location?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["WishlistShareLinkResponse"];
                    };
                };
                /** @description Authentication is required */
                readonly 401: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description The authenticated user is not authorized */
                readonly 403: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description Not Found */
                readonly 404: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Conflict */
                readonly 409: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Internal server error */
                readonly 500: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description Service Unavailable */
                readonly 503: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
            };
        };
        /** Revokes the active share link. */
        readonly delete: {
            readonly parameters: {
                readonly query?: never;
                readonly header: {
                    /** @description Strong entity tag returned when the resource was retrieved or last modified. */
                    readonly "If-Match": string;
                };
                readonly path: {
                    /** @description The wishlist identifier. */
                    readonly wishlistId: string;
                };
                readonly cookie?: never;
            };
            readonly requestBody?: never;
            readonly responses: {
                /** @description No Content */
                readonly 204: {
                    headers: {
                        /** @description Always no-store for this response. */
                        readonly "Cache-Control"?: string;
                        readonly [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Bad Request */
                readonly 400: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Authentication is required */
                readonly 401: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description The authenticated user is not authorized */
                readonly 403: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description Not Found */
                readonly 404: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Precondition Failed */
                readonly 412: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Precondition Required */
                readonly 428: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Internal server error */
                readonly 500: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description Service Unavailable */
                readonly 503: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
            };
        };
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/wishlists/{wishlistId}/wishes": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /** Gets all gift wishes from an owned private wishlist. */
        readonly get: {
            readonly parameters: {
                readonly query?: never;
                readonly header?: never;
                readonly path: {
                    /** @description The parent wishlist identifier. */
                    readonly wishlistId: string;
                };
                readonly cookie?: never;
            };
            readonly requestBody?: never;
            readonly responses: {
                /** @description OK */
                readonly 200: {
                    headers: {
                        /** @description Always no-store for this response. */
                        readonly "Cache-Control"?: string;
                        /** @description Strong entity tag representing the current resource version. */
                        readonly ETag?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["WishCollectionResponse"];
                    };
                };
                /** @description Authentication is required */
                readonly 401: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description The authenticated user is not authorized */
                readonly 403: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description Not Found */
                readonly 404: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Internal server error */
                readonly 500: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description Service Unavailable */
                readonly 503: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
            };
        };
        readonly put?: never;
        /** Adds a gift wish manually to an owned private wishlist. */
        readonly post: {
            readonly parameters: {
                readonly query?: never;
                readonly header?: never;
                readonly path: {
                    /** @description The parent wishlist identifier. */
                    readonly wishlistId: string;
                };
                readonly cookie?: never;
            };
            /** @description The cancellation token. */
            readonly requestBody: {
                readonly content: {
                    readonly "application/*+json": components["schemas"]["CreateWishRequest"];
                    readonly "application/json": components["schemas"]["CreateWishRequest"];
                };
            };
            readonly responses: {
                /** @description Created */
                readonly 201: {
                    headers: {
                        /** @description Always no-store for this response. */
                        readonly "Cache-Control"?: string;
                        /** @description Strong entity tag representing the current resource version. */
                        readonly ETag?: string;
                        /** @description URL of the created resource. */
                        readonly Location?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["WishResponse"];
                    };
                };
                /** @description Bad Request */
                readonly 400: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Authentication is required */
                readonly 401: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description The authenticated user is not authorized */
                readonly 403: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description Not Found */
                readonly 404: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Conflict */
                readonly 409: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Payload Too Large */
                readonly 413: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Unsupported Media Type */
                readonly 415: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Internal server error */
                readonly 500: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description Service Unavailable */
                readonly 503: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
            };
        };
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        /** Replaces the complete order of gift wishes in an owned private wishlist. */
        readonly patch: {
            readonly parameters: {
                readonly query?: never;
                readonly header: {
                    /** @description Strong entity tag returned when the resource was retrieved or last modified. */
                    readonly "If-Match": string;
                };
                readonly path: {
                    /** @description The parent wishlist identifier. */
                    readonly wishlistId: string;
                };
                readonly cookie?: never;
            };
            /** @description The cancellation token. */
            readonly requestBody: {
                readonly content: {
                    readonly "application/*+json": components["schemas"]["ReorderWishesRequest"];
                    readonly "application/json": components["schemas"]["ReorderWishesRequest"];
                };
            };
            readonly responses: {
                /** @description OK */
                readonly 200: {
                    headers: {
                        /** @description Always no-store for this response. */
                        readonly "Cache-Control"?: string;
                        /** @description Strong entity tag representing the current resource version. */
                        readonly ETag?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["WishOrderResponse"];
                    };
                };
                /** @description Bad Request */
                readonly 400: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Authentication is required */
                readonly 401: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description The authenticated user is not authorized */
                readonly 403: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description Not Found */
                readonly 404: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Conflict */
                readonly 409: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Precondition Failed */
                readonly 412: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Payload Too Large */
                readonly 413: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Unsupported Media Type */
                readonly 415: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Precondition Required */
                readonly 428: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Internal server error */
                readonly 500: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description Service Unavailable */
                readonly 503: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
            };
        };
        readonly trace?: never;
    };
    readonly "/api/v1/wishlists/{wishlistId}/wishes/{wishId}": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /** Gets one gift wish from an owned private wishlist. */
        readonly get: operations["GetWish"];
        /** Updates a gift wish in an owned private wishlist. */
        readonly put: {
            readonly parameters: {
                readonly query?: never;
                readonly header: {
                    /** @description Strong entity tag returned when the resource was retrieved or last modified. */
                    readonly "If-Match": string;
                };
                readonly path: {
                    /** @description The wish identifier. */
                    readonly wishId: string;
                    /** @description The parent wishlist identifier. */
                    readonly wishlistId: string;
                };
                readonly cookie?: never;
            };
            /** @description The cancellation token. */
            readonly requestBody: {
                readonly content: {
                    readonly "application/*+json": components["schemas"]["UpdateWishRequest"];
                    readonly "application/json": components["schemas"]["UpdateWishRequest"];
                };
            };
            readonly responses: {
                /** @description OK */
                readonly 200: {
                    headers: {
                        /** @description Always no-store for this response. */
                        readonly "Cache-Control"?: string;
                        /** @description Strong entity tag representing the current resource version. */
                        readonly ETag?: string;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["WishResponse"];
                    };
                };
                /** @description Bad Request */
                readonly 400: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Authentication is required */
                readonly 401: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description The authenticated user is not authorized */
                readonly 403: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description Not Found */
                readonly 404: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Conflict */
                readonly 409: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Precondition Failed */
                readonly 412: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Payload Too Large */
                readonly 413: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Unsupported Media Type */
                readonly 415: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Precondition Required */
                readonly 428: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Internal server error */
                readonly 500: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description Service Unavailable */
                readonly 503: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
            };
        };
        readonly post?: never;
        /** Deletes a gift wish from an owned private wishlist. */
        readonly delete: {
            readonly parameters: {
                readonly query?: never;
                readonly header: {
                    /** @description Strong entity tag returned when the resource was retrieved or last modified. */
                    readonly "If-Match": string;
                };
                readonly path: {
                    /** @description The wish identifier. */
                    readonly wishId: string;
                    /** @description The parent wishlist identifier. */
                    readonly wishlistId: string;
                };
                readonly cookie?: never;
            };
            readonly requestBody?: never;
            readonly responses: {
                /** @description No Content */
                readonly 204: {
                    headers: {
                        /** @description Always no-store for this response. */
                        readonly "Cache-Control"?: string;
                        readonly [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Bad Request */
                readonly 400: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Authentication is required */
                readonly 401: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description The authenticated user is not authorized */
                readonly 403: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description Not Found */
                readonly 404: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Precondition Failed */
                readonly 412: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Precondition Required */
                readonly 428: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Internal server error */
                readonly 500: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": {
                            /** @description Gets error code. */
                            readonly errorCode: null | string;
                            /** @description Gets message. */
                            readonly message: null | string;
                            /**
                             * Format: int32
                             * @description Gets status code.
                             */
                            readonly statusCode: number | string;
                            /** @description Gets title. */
                            readonly title: null | string;
                            /** @description Gets validation errors. */
                            readonly validationErrors: null | readonly {
                                /** @description Gets error message. */
                                readonly errorMessage: null | string;
                                /** @description Gets property name. */
                                readonly propertyName: null | string;
                            }[];
                        };
                    };
                };
                /** @description Service Unavailable */
                readonly 503: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
            };
        };
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/security/csrf-token": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly get: operations["GetCsrfToken"];
        readonly put?: never;
        readonly post?: never;
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /** @description Represents a bearer access token response. */
        readonly AccessTokenResponse: {
            /** @description Gets the encoded access token. */
            readonly accessToken: string;
            /**
             * Format: int32
             * @description Gets the token lifetime in seconds.
             */
            readonly expiresIn: number | string;
            /** @description Gets the authorization scheme. */
            readonly tokenType: string;
        };
        /** @description Represents confirm email request. */
        readonly ConfirmEmailRequest: {
            /** @description Gets token. */
            readonly token: null | string;
            /** @description Gets user id. */
            readonly userId: null | string;
        };
        /** @description Represents a request to confirm a member email change. */
        readonly ConfirmMemberEmailChangeRequest: {
            /**
             * Format: uuid
             * @description Gets the email change request identifier.
             */
            readonly requestId: null | string;
            /** @description Gets the email change confirmation token. */
            readonly token: null | string;
        };
        /** @description Represents a private wishlist creation request. */
        readonly CreateWishlistRequest: {
            /**
             * Format: date
             * @description Gets the optional event date.
             */
            readonly eventDate: null | string;
            /** @description Gets the optional owner message. */
            readonly message: null | string;
            /** @description Gets the requested name. */
            readonly name: null | string;
            /** @description Gets the requested occasion. */
            readonly occasion: components["schemas"]["WishlistOccasion"];
        };
        /** @description Represents a manual gift wish creation request. */
        readonly CreateWishRequest: {
            /** @description Gets the requested name. */
            readonly name: null | string;
            /** @description Gets the optional owner note. */
            readonly note: null | string;
            /**
             * Format: double
             * @description Gets the optional price in euros.
             */
            readonly price: null | number | string;
            /**
             * Format: int32
             * @description Gets the optional total desired quantity, which defaults to one.
             */
            readonly quantity?: null | number | string;
            /** @description Gets the optional product URL. */
            readonly url: null | string;
        };
        /** @description Represents csrf token response. */
        readonly CsrfTokenResponse: {
            /** @description Gets token. */
            readonly token: string;
        };
        /** @description Represents the current authenticated member session response. */
        readonly CurrentSessionResponse: {
            /** @description Gets the member display name. */
            readonly displayName: string;
            /** @description Gets the member email address. */
            readonly email: string;
            /**
             * Format: uuid
             * @description Gets the member identifier.
             */
            readonly id: string;
            /** @description Gets the current member roles. */
            readonly roles: readonly string[];
        };
        /** @description Represents error response. */
        readonly ErrorResponse: {
            /** @description Gets error code. */
            readonly errorCode: null | string;
            /** @description Gets message. */
            readonly message: null | string;
            /**
             * Format: int32
             * @description Gets status code.
             */
            readonly statusCode: number | string;
            /** @description Gets title. */
            readonly title: null | string;
            /** @description Gets validation errors. */
            readonly validationErrors: null | readonly components["schemas"]["ValidationError"][];
        };
        /** @description Represents one reservation lifecycle from the current member's history. */
        readonly GiftReservationHistoryResponse: {
            /**
             * Format: date-time
             * @description Gets the UTC lifecycle creation date and time.
             */
            readonly createdAt: string;
            /**
             * Format: date-time
             * @description Gets the optional UTC lifecycle end date and time.
             */
            readonly endedAt: null | string;
            /**
             * Format: uuid
             * @description Gets the reservation lifecycle identifier.
             */
            readonly id: string;
            /**
             * Format: date-time
             * @description Gets the UTC date and time of the latest lifecycle activity.
             */
            readonly lastActivityAt: string;
            /**
             * Format: int32
             * @description Gets the latest reserved quantity.
             */
            readonly quantity: number | string;
            /**
             * Format: uuid
             * @description Gets the current share-link identifier when available.
             */
            readonly shareLinkId: null | string;
            /** @description Gets the lifecycle status. */
            readonly status: components["schemas"]["GiftReservationHistoryStatus"];
            /**
             * Format: uuid
             * @description Gets the original gift-wish identifier.
             */
            readonly wishId: string;
            /**
             * Format: uuid
             * @description Gets the original wishlist identifier.
             */
            readonly wishlistId: string;
            /** @description Gets the current or retained wishlist name. */
            readonly wishlistName: string;
            /** @description Gets the current or retained gift-wish name. */
            readonly wishName: string;
        };
        /**
         * @description Describes the current outcome of one member reservation lifecycle.
         * @enum {string}
         */
        readonly GiftReservationHistoryStatus: "active" | "cancelled" | "unavailable";
        /** @description Represents the current participant's reservation for one gift. */
        readonly GiftReservationResponse: {
            /**
             * Format: date-time
             * @description Gets the UTC creation date and time.
             */
            readonly createdAt?: string;
            /**
             * Format: uuid
             * @description Gets the reservation identifier.
             */
            readonly id?: string;
            /**
             * Format: int32
             * @description Gets the reserved quantity.
             */
            readonly quantity?: number | string;
            /**
             * Format: date-time
             * @description Gets the optional UTC update date and time.
             */
            readonly updatedAt?: null | string;
            /**
             * Format: uuid
             * @description Gets the gift-wish identifier.
             */
            readonly wishId?: string;
        };
        /** @description Represents optional anonymous details used to join a shared wishlist. */
        readonly JoinSharedWishlistRequest: {
            /** @description Gets the anonymous display name. */
            readonly displayName: null | string;
        };
        /** @description Represents proof of the current MonKado account for an explicit Google link. */
        readonly LinkGoogleAccountRequest: {
            /** @description Gets the exact current MonKado password. */
            readonly currentPassword: null | string;
        };
        /** @description Represents login request. */
        readonly LoginRequest: {
            /** @description Gets email. */
            readonly email: null | string;
            /** @description Gets password. */
            readonly password: null | string;
            /**
             * @description Gets remember me.
             * @default false
             */
            readonly rememberMe: boolean;
        };
        /** @description Represents the editable profile of a member. */
        readonly MemberProfileResponse: {
            /** @description Gets the member display name. */
            readonly displayName: string;
        };
        /** @description Represents one page of API results. */
        readonly PaginatedResponseOfGiftReservationHistoryResponse: {
            /**
             * Format: int32
             * @description Gets the requested one-based page number.
             */
            readonly currentPage: number | string;
            /** @description Gets whether a following page containing items exists. */
            readonly hasNextPage?: boolean;
            /** @description Gets whether a preceding page containing items exists. */
            readonly hasPreviousPage?: boolean;
            /** @description Gets the current page items. */
            readonly items: readonly components["schemas"]["GiftReservationHistoryResponse"][];
            /**
             * Format: int32
             * @description Gets the requested page size.
             */
            readonly pageSize: number | string;
            /**
             * Format: int32
             * @description Gets the total matching item count.
             */
            readonly totalCount: number | string;
            /**
             * Format: int32
             * @description Gets the total number of pages containing matching items.
             */
            readonly totalPages?: number | string;
        };
        /** @description Represents register account request. */
        readonly RegisterAccountRequest: {
            /** @description Gets display name. */
            readonly displayName: null | string;
            /** @description Gets email. */
            readonly email: null | string;
            /** @description Gets password. */
            readonly password: null | string;
        };
        /** @description Represents the complete requested order of a gift wish collection. */
        readonly ReorderWishesRequest: {
            /** @description Gets all current wish identifiers in their requested final order. */
            readonly wishIds: null | readonly string[];
        };
        /** @description Represents an anonymous shared-wishlist report request. */
        readonly ReportSharedWishlistRequest: {
            /** @description Gets the optional report details. */
            readonly details: null | string;
            /** @description Gets the report reason. */
            readonly reason: components["schemas"]["WishlistReportReason"];
        };
        /** @description Represents request email confirmation request. */
        readonly RequestEmailConfirmationRequest: {
            /** @description Gets email. */
            readonly email: null | string;
        };
        /** @description Represents a password reset email request. */
        readonly RequestPasswordResetRequest: {
            /** @description Gets the account email address. */
            readonly email: null | string;
        };
        /** @description Represents an anonymous password reset request. */
        readonly ResetPasswordRequest: {
            /** @description Gets the new account password. */
            readonly newPassword: null | string;
            /** @description Gets the password reset token. */
            readonly token: null | string;
            /** @description Gets the account identifier from the reset link. */
            readonly userId: null | string;
        };
        /** @description Represents detailed public information about a shared gift wish. */
        readonly SharedWishDetailResponse: {
            /**
             * Format: int32
             * @description Gets the remaining quantity.
             */
            readonly availableQuantity?: number | string;
            /**
             * Format: int32
             * @description Gets the quantity reserved by the current participant when one is joined.
             */
            readonly currentParticipantReservedQuantity?: null | number | string;
            /**
             * Format: uuid
             * @description Gets the gift-wish identifier.
             */
            readonly id?: string;
            /** @description Gets the gift-wish name. */
            readonly name?: string;
            /** @description Gets the optional public description written by the owner. */
            readonly note?: null | string;
            /**
             * Format: double
             * @description Gets the optional price in euros.
             */
            readonly price?: null | number | string;
            /**
             * Format: int32
             * @description Gets the total desired quantity.
             */
            readonly quantity?: number | string;
            /**
             * Format: int32
             * @description Gets the total quantity reserved by all participants.
             */
            readonly reservedQuantity?: number | string;
            /** @description Gets the optional product URL. */
            readonly url?: null | string;
        };
        /** @description Represents a wishlist exposed through a share link. */
        readonly SharedWishlistResponse: {
            readonly currentParticipant?: null | components["schemas"]["WishlistParticipantResponse"];
            /**
             * Format: date
             * @description Gets the optional event date.
             */
            readonly eventDate?: null | string;
            /**
             * Format: uuid
             * @description Gets the wishlist identifier.
             */
            readonly id?: string;
            /** @description Gets the optional owner message. */
            readonly message?: null | string;
            /** @description Gets the wishlist name. */
            readonly name?: string;
            /** @description Gets the occasion. */
            readonly occasion?: components["schemas"]["WishlistOccasion"];
            /** @description Gets the owner display name. */
            readonly ownerDisplayName?: string;
            /** @description Gets the ordered public gift wishes. */
            readonly wishes?: readonly components["schemas"]["SharedWishResponse"][];
        };
        /** @description Represents a gift wish exposed through a share link. */
        readonly SharedWishResponse: {
            /**
             * Format: int32
             * @description Gets the remaining quantity, clamped to zero.
             */
            readonly availableQuantity?: number | string;
            /**
             * Format: int32
             * @description Gets the quantity reserved by the current participant when one is joined.
             */
            readonly currentParticipantReservedQuantity?: null | number | string;
            /**
             * Format: uuid
             * @description Gets the gift-wish identifier.
             */
            readonly id?: string;
            /** @description Gets the gift-wish name. */
            readonly name?: string;
            /**
             * Format: double
             * @description Gets the optional price in euros.
             */
            readonly price?: null | number | string;
            /**
             * Format: int32
             * @description Gets the total desired quantity.
             */
            readonly quantity?: number | string;
            /**
             * Format: int32
             * @description Gets the total quantity reserved by all participants.
             */
            readonly reservedQuantity?: number | string;
            /** @description Gets the optional product URL. */
            readonly url?: null | string;
        };
        /** @description Represents a request to update the current member email address. */
        readonly UpdateMemberEmailRequest: {
            /** @description Gets the current member password. */
            readonly currentPassword: null | string;
            /** @description Gets the requested email address. */
            readonly email: null | string;
        };
        /** @description Represents a current member password update request. */
        readonly UpdateMemberPasswordRequest: {
            /** @description Gets the current member password. */
            readonly currentPassword: null | string;
            /** @description Gets the new member password. */
            readonly newPassword: null | string;
        };
        /** @description Represents a request to update the current member profile. */
        readonly UpdateMemberProfileRequest: {
            /** @description Gets the requested display name. */
            readonly displayName: null | string;
        };
        /** @description Represents a private wishlist update request. */
        readonly UpdateWishlistRequest: {
            /**
             * Format: date
             * @description Gets the optional event date.
             */
            readonly eventDate: null | string;
            /** @description Gets the optional owner message. */
            readonly message: null | string;
            /** @description Gets the requested name. */
            readonly name: null | string;
            /** @description Gets the requested occasion. */
            readonly occasion: components["schemas"]["WishlistOccasion"];
        };
        /** @description Represents a gift wish update request. */
        readonly UpdateWishRequest: {
            /** @description Gets the requested name. */
            readonly name: null | string;
            /** @description Gets the optional owner note. */
            readonly note: null | string;
            /**
             * Format: double
             * @description Gets the optional price in euros.
             */
            readonly price: null | number | string;
            /**
             * Format: int32
             * @description Gets the required total desired quantity.
             */
            readonly quantity?: null | number | string;
            /** @description Gets the optional product URL. */
            readonly url: null | string;
        };
        /** @description Represents an absolute gift-reservation quantity replacement. */
        readonly UpsertGiftReservationRequest: {
            /**
             * Format: int32
             * @description Gets the requested reserved quantity.
             */
            readonly quantity: null | number | string;
        };
        /** @description Represents validation error. */
        readonly ValidationError: {
            /** @description Gets error message. */
            readonly errorMessage: null | string;
            /** @description Gets property name. */
            readonly propertyName: null | string;
        };
        /** @description Represents one gift wish inside a versioned collection response. */
        readonly WishCollectionItemResponse: {
            /**
             * Format: date-time
             * @description Gets the UTC creation date and time.
             */
            readonly createdAt?: string;
            /** @description Gets the individual strong entity tag. */
            readonly entityTag: string;
            /**
             * Format: uuid
             * @description Gets the wish identifier.
             */
            readonly id?: string;
            /** @description Gets the display name. */
            readonly name?: null | string;
            /** @description Gets the optional owner note. */
            readonly note?: null | string;
            /**
             * Format: int64
             * @description Gets the position inside the parent wishlist.
             */
            readonly position?: number | string;
            /**
             * Format: double
             * @description Gets the optional price in euros.
             */
            readonly price?: null | number | string;
            /**
             * Format: date-time
             * @description Gets the optional UTC update date and time.
             */
            readonly updatedAt?: null | string;
            /** @description Gets the optional product URL. */
            readonly url?: null | string;
            /**
             * Format: uuid
             * @description Gets the parent wishlist identifier.
             */
            readonly wishlistId?: string;
        };
        /** @description Represents all gift wishes from a private wishlist. */
        readonly WishCollectionResponse: {
            /** @description Gets all gift wishes ordered by position. */
            readonly wishes: readonly components["schemas"]["WishCollectionItemResponse"][];
        };
        /**
         * @description Identifies the occasion associated with a wishlist.
         * @enum {string}
         */
        readonly WishlistOccasion: "birthday" | "christmas" | "wedding" | "birth" | "other";
        /** @description Represents the wishlist participant associated with the current caller. */
        readonly WishlistParticipantResponse: {
            /** @description Gets the current display name. */
            readonly displayName: string;
            /**
             * Format: uuid
             * @description Gets the participant identifier.
             */
            readonly id: string;
        };
        /** @enum {string} */
        readonly WishlistReportReason: "spamOrScam" | "inappropriateContent" | "privacyViolation" | "other";
        /** @description Represents the private details of a wishlist. */
        readonly WishlistResponse: {
            /**
             * Format: date-time
             * @description Gets the UTC creation date and time.
             */
            readonly createdAt: string;
            /**
             * Format: date
             * @description Gets the optional event date.
             */
            readonly eventDate: null | string;
            /**
             * Format: uuid
             * @description Gets the wishlist identifier.
             */
            readonly id: string;
            /** @description Gets the optional owner message. */
            readonly message: null | string;
            /** @description Gets the display name. */
            readonly name: string;
            /** @description Gets the associated occasion. */
            readonly occasion: components["schemas"]["WishlistOccasion"];
            /**
             * Format: date-time
             * @description Gets the optional UTC update date and time.
             */
            readonly updatedAt: null | string;
        };
        /** @description Represents an owner-facing wishlist share link. */
        readonly WishlistShareLinkResponse: {
            /**
             * Format: date-time
             * @description Gets the UTC creation date and time.
             */
            readonly createdAt: string;
            /**
             * Format: uuid
             * @description Gets the share-link identifier.
             */
            readonly id: string;
            /** @description Gets the copyable frontend URL. */
            readonly shareUrl: string;
            /**
             * Format: date-time
             * @description Gets the optional UTC rotation date and time.
             */
            readonly updatedAt: null | string;
        };
        /** @description Represents one gift wish inside a complete order response. */
        readonly WishOrderItemResponse: {
            /** @description Gets the individual strong entity tag. */
            readonly entityTag: string;
            /**
             * Format: uuid
             * @description Gets the wish identifier.
             */
            readonly id: string;
            /**
             * Format: int64
             * @description Gets the position inside the parent wishlist.
             */
            readonly position: number | string;
        };
        /** @description Represents the complete lightweight order of a gift wish collection. */
        readonly WishOrderResponse: {
            /** @description Gets the complete ordered collection. */
            readonly wishes: readonly components["schemas"]["WishOrderItemResponse"][];
        };
        /** @description Represents the private details of a gift wish. */
        readonly WishResponse: {
            /**
             * Format: date-time
             * @description Gets the UTC creation date and time.
             */
            readonly createdAt: string;
            /**
             * Format: uuid
             * @description Gets the wish identifier.
             */
            readonly id: string;
            /** @description Gets the display name. */
            readonly name: string;
            /** @description Gets the optional owner note. */
            readonly note: null | string;
            /**
             * Format: int64
             * @description Gets the stable position inside the parent wishlist.
             */
            readonly position: number | string;
            /**
             * Format: double
             * @description Gets the optional price in euros.
             */
            readonly price: null | number | string;
            /**
             * Format: int32
             * @description Gets the total desired quantity.
             * @default 1
             */
            readonly quantity: number | string;
            /**
             * Format: date-time
             * @description Gets the optional UTC update date and time.
             */
            readonly updatedAt: null | string;
            /** @description Gets the optional product URL. */
            readonly url: null | string;
            /**
             * Format: uuid
             * @description Gets the parent wishlist identifier.
             */
            readonly wishlistId: string;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    readonly GetCurrentSharedWishlistParticipant: {
        readonly parameters: {
            readonly query?: never;
            readonly header?: {
                readonly "X-MonKado-Share-Token"?: string;
            };
            readonly path: {
                /** @description The public share-link identifier. */
                readonly shareLinkId: string;
            };
            readonly cookie?: {
                /** @description Persistent opaque guest-session cookie. Production uses __Host-MonKado.Guest; local development uses MonKado.Guest. */
                readonly "__Host-MonKado.Guest"?: string;
            };
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description OK */
            readonly 200: {
                headers: {
                    /** @description Always no-store for this response. */
                    readonly "Cache-Control"?: string;
                    /** @description Prevents indexing and archiving of shared-wishlist responses. */
                    readonly "X-Robots-Tag"?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["WishlistParticipantResponse"];
                };
            };
            /** @description Unauthorized */
            readonly 401: {
                headers: {
                    /** @description Prevents indexing and archiving of shared-wishlist responses. */
                    readonly "X-Robots-Tag"?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Not Found */
            readonly 404: {
                headers: {
                    /** @description Prevents indexing and archiving of shared-wishlist responses. */
                    readonly "X-Robots-Tag"?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Too Many Requests */
            readonly 429: {
                headers: {
                    /** @description Prevents indexing and archiving of shared-wishlist responses. */
                    readonly "X-Robots-Tag"?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Internal server error */
            readonly 500: {
                headers: {
                    /** @description Prevents indexing and archiving of shared-wishlist responses. */
                    readonly "X-Robots-Tag"?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": {
                        /** @description Gets error code. */
                        readonly errorCode: null | string;
                        /** @description Gets message. */
                        readonly message: null | string;
                        /**
                         * Format: int32
                         * @description Gets status code.
                         */
                        readonly statusCode: number | string;
                        /** @description Gets title. */
                        readonly title: null | string;
                        /** @description Gets validation errors. */
                        readonly validationErrors: null | readonly {
                            /** @description Gets error message. */
                            readonly errorMessage: null | string;
                            /** @description Gets property name. */
                            readonly propertyName: null | string;
                        }[];
                    };
                };
            };
            /** @description Service Unavailable */
            readonly 503: {
                headers: {
                    /** @description Prevents indexing and archiving of shared-wishlist responses. */
                    readonly "X-Robots-Tag"?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly GetCurrentSharedWishlistGiftReservation: {
        readonly parameters: {
            readonly query?: never;
            readonly header?: {
                readonly "X-MonKado-Share-Token"?: string;
            };
            readonly path: {
                /** @description The public share-link identifier. */
                readonly shareLinkId: string;
                /** @description The gift-wish identifier. */
                readonly wishId: string;
            };
            readonly cookie?: {
                /** @description Persistent opaque guest-session cookie. Production uses __Host-MonKado.Guest; local development uses MonKado.Guest. */
                readonly "__Host-MonKado.Guest"?: string;
            };
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description OK */
            readonly 200: {
                headers: {
                    /** @description Always no-store for this response. */
                    readonly "Cache-Control"?: string;
                    /** @description Strong entity tag representing the current resource version. */
                    readonly ETag?: string;
                    /** @description Prevents indexing and archiving of shared-wishlist responses. */
                    readonly "X-Robots-Tag"?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["GiftReservationResponse"];
                };
            };
            /** @description Bad Request */
            readonly 400: {
                headers: {
                    /** @description Prevents indexing and archiving of shared-wishlist responses. */
                    readonly "X-Robots-Tag"?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unauthorized */
            readonly 401: {
                headers: {
                    /** @description Prevents indexing and archiving of shared-wishlist responses. */
                    readonly "X-Robots-Tag"?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Not Found */
            readonly 404: {
                headers: {
                    /** @description Prevents indexing and archiving of shared-wishlist responses. */
                    readonly "X-Robots-Tag"?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Too Many Requests */
            readonly 429: {
                headers: {
                    /** @description Prevents indexing and archiving of shared-wishlist responses. */
                    readonly "X-Robots-Tag"?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Internal server error */
            readonly 500: {
                headers: {
                    /** @description Prevents indexing and archiving of shared-wishlist responses. */
                    readonly "X-Robots-Tag"?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": {
                        /** @description Gets error code. */
                        readonly errorCode: null | string;
                        /** @description Gets message. */
                        readonly message: null | string;
                        /**
                         * Format: int32
                         * @description Gets status code.
                         */
                        readonly statusCode: number | string;
                        /** @description Gets title. */
                        readonly title: null | string;
                        /** @description Gets validation errors. */
                        readonly validationErrors: null | readonly {
                            /** @description Gets error message. */
                            readonly errorMessage: null | string;
                            /** @description Gets property name. */
                            readonly propertyName: null | string;
                        }[];
                    };
                };
            };
            /** @description Service Unavailable */
            readonly 503: {
                headers: {
                    /** @description Prevents indexing and archiving of shared-wishlist responses. */
                    readonly "X-Robots-Tag"?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly GetWishlist: {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path: {
                /** @description The wishlist identifier. */
                readonly wishlistId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description OK */
            readonly 200: {
                headers: {
                    /** @description Always no-store for this response. */
                    readonly "Cache-Control"?: string;
                    /** @description Strong entity tag representing the current resource version. */
                    readonly ETag?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["WishlistResponse"];
                };
            };
            /** @description Authentication is required */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": {
                        /** @description Gets error code. */
                        readonly errorCode: null | string;
                        /** @description Gets message. */
                        readonly message: null | string;
                        /**
                         * Format: int32
                         * @description Gets status code.
                         */
                        readonly statusCode: number | string;
                        /** @description Gets title. */
                        readonly title: null | string;
                        /** @description Gets validation errors. */
                        readonly validationErrors: null | readonly {
                            /** @description Gets error message. */
                            readonly errorMessage: null | string;
                            /** @description Gets property name. */
                            readonly propertyName: null | string;
                        }[];
                    };
                };
            };
            /** @description The authenticated user is not authorized */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": {
                        /** @description Gets error code. */
                        readonly errorCode: null | string;
                        /** @description Gets message. */
                        readonly message: null | string;
                        /**
                         * Format: int32
                         * @description Gets status code.
                         */
                        readonly statusCode: number | string;
                        /** @description Gets title. */
                        readonly title: null | string;
                        /** @description Gets validation errors. */
                        readonly validationErrors: null | readonly {
                            /** @description Gets error message. */
                            readonly errorMessage: null | string;
                            /** @description Gets property name. */
                            readonly propertyName: null | string;
                        }[];
                    };
                };
            };
            /** @description Not Found */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Internal server error */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": {
                        /** @description Gets error code. */
                        readonly errorCode: null | string;
                        /** @description Gets message. */
                        readonly message: null | string;
                        /**
                         * Format: int32
                         * @description Gets status code.
                         */
                        readonly statusCode: number | string;
                        /** @description Gets title. */
                        readonly title: null | string;
                        /** @description Gets validation errors. */
                        readonly validationErrors: null | readonly {
                            /** @description Gets error message. */
                            readonly errorMessage: null | string;
                            /** @description Gets property name. */
                            readonly propertyName: null | string;
                        }[];
                    };
                };
            };
            /** @description Service Unavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly GetWishlistShareLink: {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path: {
                /** @description The wishlist identifier. */
                readonly wishlistId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description OK */
            readonly 200: {
                headers: {
                    /** @description Always no-store for this response. */
                    readonly "Cache-Control"?: string;
                    /** @description Strong entity tag representing the current resource version. */
                    readonly ETag?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["WishlistShareLinkResponse"];
                };
            };
            /** @description Authentication is required */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": {
                        /** @description Gets error code. */
                        readonly errorCode: null | string;
                        /** @description Gets message. */
                        readonly message: null | string;
                        /**
                         * Format: int32
                         * @description Gets status code.
                         */
                        readonly statusCode: number | string;
                        /** @description Gets title. */
                        readonly title: null | string;
                        /** @description Gets validation errors. */
                        readonly validationErrors: null | readonly {
                            /** @description Gets error message. */
                            readonly errorMessage: null | string;
                            /** @description Gets property name. */
                            readonly propertyName: null | string;
                        }[];
                    };
                };
            };
            /** @description The authenticated user is not authorized */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": {
                        /** @description Gets error code. */
                        readonly errorCode: null | string;
                        /** @description Gets message. */
                        readonly message: null | string;
                        /**
                         * Format: int32
                         * @description Gets status code.
                         */
                        readonly statusCode: number | string;
                        /** @description Gets title. */
                        readonly title: null | string;
                        /** @description Gets validation errors. */
                        readonly validationErrors: null | readonly {
                            /** @description Gets error message. */
                            readonly errorMessage: null | string;
                            /** @description Gets property name. */
                            readonly propertyName: null | string;
                        }[];
                    };
                };
            };
            /** @description Not Found */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Internal server error */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": {
                        /** @description Gets error code. */
                        readonly errorCode: null | string;
                        /** @description Gets message. */
                        readonly message: null | string;
                        /**
                         * Format: int32
                         * @description Gets status code.
                         */
                        readonly statusCode: number | string;
                        /** @description Gets title. */
                        readonly title: null | string;
                        /** @description Gets validation errors. */
                        readonly validationErrors: null | readonly {
                            /** @description Gets error message. */
                            readonly errorMessage: null | string;
                            /** @description Gets property name. */
                            readonly propertyName: null | string;
                        }[];
                    };
                };
            };
            /** @description Service Unavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly GetWish: {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path: {
                /** @description The wish identifier. */
                readonly wishId: string;
                /** @description The parent wishlist identifier. */
                readonly wishlistId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description OK */
            readonly 200: {
                headers: {
                    /** @description Always no-store for this response. */
                    readonly "Cache-Control"?: string;
                    /** @description Strong entity tag representing the current resource version. */
                    readonly ETag?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["WishResponse"];
                };
            };
            /** @description Authentication is required */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": {
                        /** @description Gets error code. */
                        readonly errorCode: null | string;
                        /** @description Gets message. */
                        readonly message: null | string;
                        /**
                         * Format: int32
                         * @description Gets status code.
                         */
                        readonly statusCode: number | string;
                        /** @description Gets title. */
                        readonly title: null | string;
                        /** @description Gets validation errors. */
                        readonly validationErrors: null | readonly {
                            /** @description Gets error message. */
                            readonly errorMessage: null | string;
                            /** @description Gets property name. */
                            readonly propertyName: null | string;
                        }[];
                    };
                };
            };
            /** @description The authenticated user is not authorized */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": {
                        /** @description Gets error code. */
                        readonly errorCode: null | string;
                        /** @description Gets message. */
                        readonly message: null | string;
                        /**
                         * Format: int32
                         * @description Gets status code.
                         */
                        readonly statusCode: number | string;
                        /** @description Gets title. */
                        readonly title: null | string;
                        /** @description Gets validation errors. */
                        readonly validationErrors: null | readonly {
                            /** @description Gets error message. */
                            readonly errorMessage: null | string;
                            /** @description Gets property name. */
                            readonly propertyName: null | string;
                        }[];
                    };
                };
            };
            /** @description Not Found */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Internal server error */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": {
                        /** @description Gets error code. */
                        readonly errorCode: null | string;
                        /** @description Gets message. */
                        readonly message: null | string;
                        /**
                         * Format: int32
                         * @description Gets status code.
                         */
                        readonly statusCode: number | string;
                        /** @description Gets title. */
                        readonly title: null | string;
                        /** @description Gets validation errors. */
                        readonly validationErrors: null | readonly {
                            /** @description Gets error message. */
                            readonly errorMessage: null | string;
                            /** @description Gets property name. */
                            readonly propertyName: null | string;
                        }[];
                    };
                };
            };
            /** @description Service Unavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly GetCsrfToken: {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description OK */
            readonly 200: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["CsrfTokenResponse"];
                };
            };
            /** @description Internal server error */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": {
                        /** @description Gets error code. */
                        readonly errorCode: null | string;
                        /** @description Gets message. */
                        readonly message: null | string;
                        /**
                         * Format: int32
                         * @description Gets status code.
                         */
                        readonly statusCode: number | string;
                        /** @description Gets title. */
                        readonly title: null | string;
                        /** @description Gets validation errors. */
                        readonly validationErrors: null | readonly {
                            /** @description Gets error message. */
                            readonly errorMessage: null | string;
                            /** @description Gets property name. */
                            readonly propertyName: null | string;
                        }[];
                    };
                };
            };
        };
    };
}
