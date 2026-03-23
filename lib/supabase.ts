type QueryResult<T> = { data: T | null; error: { message: string } | null };

type OrderOptions = { ascending?: boolean };

type PendingAction = 'select' | 'insert' | 'update' | 'delete';

type Filter = { column: string; value: string | number | boolean };

class PostgrestQueryBuilder<T> {
  private filters: Filter[] = [];
  private orderBy?: { column: string; ascending: boolean };
  private rowLimit?: number;
  private returning = false;
  private expectSingle = false;
  private allowMaybeSingle = false;

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly table: string,
    private readonly action: PendingAction,
    private readonly payload?: Record<string, unknown>,
    private readonly columns = '*',
  ) {}

  select(columns = '*') {
    if (this.action === 'insert' || this.action === 'update') {
      this.returning = true;
      return new PostgrestQueryBuilder<T>(this.baseUrl, this.apiKey, this.table, this.action, this.payload, columns)
        .copyStateFrom(this);
    }

    return new PostgrestQueryBuilder<T>(this.baseUrl, this.apiKey, this.table, 'select', undefined, columns)
      .copyStateFrom(this);
  }

  update(values: Record<string, unknown>) {
    return new PostgrestQueryBuilder<T>(this.baseUrl, this.apiKey, this.table, 'update', values, this.columns)
      .copyStateFrom(this);
  }

  insert(values: Record<string, unknown>) {
    return new PostgrestQueryBuilder<T>(this.baseUrl, this.apiKey, this.table, 'insert', values, this.columns)
      .copyStateFrom(this);
  }

  delete() {
    return new PostgrestQueryBuilder<T>(this.baseUrl, this.apiKey, this.table, 'delete', undefined, this.columns)
      .copyStateFrom(this);
  }

  eq(column: string, value: string | number | boolean) {
    this.filters.push({ column, value });
    return this;
  }

  order(column: string, options?: OrderOptions) {
    this.orderBy = { column, ascending: options?.ascending ?? true };
    return this;
  }

  limit(value: number) {
    this.rowLimit = value;
    return this;
  }

  single(): Promise<QueryResult<T>> {
    this.expectSingle = true;
    return this.execute();
  }

  maybeSingle(): Promise<QueryResult<T>> {
    this.allowMaybeSingle = true;
    return this.execute();
  }

  then<TResult1 = QueryResult<T>, TResult2 = never>(
    onfulfilled?: ((value: QueryResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }

  private copyStateFrom(source: PostgrestQueryBuilder<T>) {
    this.filters = [...source.filters];
    this.orderBy = source.orderBy;
    this.rowLimit = source.rowLimit;
    this.returning = source.returning;
    this.expectSingle = source.expectSingle;
    this.allowMaybeSingle = source.allowMaybeSingle;
    return this;
  }

  private async execute(): Promise<QueryResult<T>> {
    try {
      const url = new URL(`${this.baseUrl}/rest/v1/${this.table}`);
      url.searchParams.set('select', this.columns);

      for (const filter of this.filters) {
        url.searchParams.set(filter.column, `eq.${String(filter.value)}`);
      }

      if (this.orderBy) {
        url.searchParams.set('order', `${this.orderBy.column}.${this.orderBy.ascending ? 'asc' : 'desc'}`);
      }

      if (typeof this.rowLimit === 'number') {
        url.searchParams.set('limit', String(this.rowLimit));
      }

      const headers: Record<string, string> = {
        apikey: this.apiKey,
        Authorization: `Bearer ${this.apiKey}`,
      };

      let method = 'GET';
      let body: string | undefined;

      if (this.action === 'insert') {
        method = 'POST';
        body = JSON.stringify(this.payload ?? {});
        headers['Content-Type'] = 'application/json';
        headers.Prefer = this.returning ? 'return=representation' : 'return=minimal';
      } else if (this.action === 'update') {
        method = 'PATCH';
        body = JSON.stringify(this.payload ?? {});
        headers['Content-Type'] = 'application/json';
        headers.Prefer = this.returning ? 'return=representation' : 'return=minimal';
      } else if (this.action === 'delete') {
        method = 'DELETE';
      }

      if (this.expectSingle || this.allowMaybeSingle) {
        headers.Accept = 'application/vnd.pgrst.object+json';
      }

      const response = await fetch(url, { method, headers, body, cache: 'no-store' });
      const text = await response.text();
      const parsed = text ? JSON.parse(text) : null;

      if (!response.ok) {
        const details = parsed?.message ?? parsed?.error ?? response.statusText;

        if (this.allowMaybeSingle && response.status === 406) {
          return { data: null, error: null };
        }

        return { data: null, error: { message: details } };
      }

      return { data: parsed as T, error: null };
    } catch (error) {
      return {
        data: null,
        error: { message: error instanceof Error ? error.message : 'Unknown Supabase request error' },
      };
    }
  }
}

class SupabaseRestClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
  ) {}

  from<T>(table: string) {
    return new PostgrestQueryBuilder<T>(this.baseUrl, this.apiKey, table, 'select');
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = new SupabaseRestClient(supabaseUrl, supabaseKey);
