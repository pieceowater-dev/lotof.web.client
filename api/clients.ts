import { GraphQLClient } from "graphql-request";

export class ApiClient {
  private client: GraphQLClient;

  constructor(baseURL: string) {
    this.client = new GraphQLClient(baseURL + "/query");
  }

  async request<T>(query: string, variables?: Record<string, any>): Promise<T> {
    try {
      return await this.client.request<T>(query, variables);
    } catch (error: any) {
      console.error("GraphQL Error:", error.response?.errors || error.message);
      throw new Error(error.response?.errors?.[0]?.message || "GraphQL request failed");
    }
  }
}

export const hubClient = new ApiClient(import.meta.env.VITE_API_HUB);
export const atraceClient = new ApiClient(import.meta.env.VITE_API_ATRACE);