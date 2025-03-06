import { GraphQLClient } from 'graphql-request';

export const hubClient = new GraphQLClient(import.meta.env.VITE_API_HUB + "/query");
export const atraceClient = new GraphQLClient(import.meta.env.VITE_API_ATRACE + "/query");