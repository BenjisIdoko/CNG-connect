/** The one method of the Supabase client that our service functions use, so tests can pass a fake. */
export interface RpcClient {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data?: unknown; error: { message: string } | null }>;
}
