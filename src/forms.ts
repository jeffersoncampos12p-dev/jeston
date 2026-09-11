import type { ReactNode } from 'react';
import { createElement } from 'react';
import { assertSerializable } from './actions.js';

export interface FormError {
  field?: string;
  message: string;
}

export interface FormState<T = unknown> {
  ok: boolean;
  data?: T;
  errors: FormError[];
  status?: number;
  redirect?: string;
}

export interface FormDefinition<TInput = Record<string, unknown>, TResult = unknown> {
  action: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  parse(input: FormData | Record<string, unknown>): TInput;
  submit(input: FormData | Record<string, unknown>, context?: { signal?: AbortSignal }): Promise<FormState<TResult>>;
  render(props?: { children?: ReactNode; className?: string; noValidate?: boolean }): ReactNode;
}

export interface FormOptions<TInput, TResult> {
  action: string;
  method?: FormDefinition<TInput, TResult>['method'];
  validate?: (input: TInput) => FormError[] | Promise<FormError[]>;
  handler: (input: TInput, context: { signal?: AbortSignal }) => TResult | Promise<TResult>;
}

function objectFromFormData(input: FormData | Record<string, unknown>): Record<string, unknown> {
  if (input instanceof FormData) {
    const result: Record<string, unknown> = {};
    input.forEach((value, key) => { result[key] = value; });
    return result;
  }
  return { ...input };
}

export function defineForm<TInput extends Record<string, unknown>, TResult>(options: FormOptions<TInput, TResult>): FormDefinition<TInput, TResult> {
  const parse = (input: FormData | Record<string, unknown>) => objectFromFormData(input) as TInput;
  return {
    action: options.action,
    method: options.method ?? 'POST',
    parse,
    async submit(input, context = {}) {
      try {
        const parsed = parse(input);
        const errors = options.validate ? await options.validate(parsed) : [];
        if (errors.length) return { ok: false, errors, status: 422 };
        const data = await options.handler(parsed, context);
        assertSerializable(data, '$form.result');
        return { ok: true, data, errors: [] };
      } catch (error) {
        return { ok: false, errors: [{ message: error instanceof Error ? error.message : 'Form submission failed' }], status: 500 };
      }
    },
    render(props = {}) {
      return createElement('form', { action: options.action, method: options.method ?? 'POST', className: props.className, noValidate: props.noValidate }, props.children);
    }
  };
}
