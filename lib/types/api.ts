export type ApiSuccess<T> = {
  data: T;
  requestId: string;
};

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_JSON"
  | "INTERNAL_ERROR";

export type ApiFailure = {
  data: null;
  error: {
    code: ApiErrorCode;
    message: string;
  };
  requestId: string;
};

export type DemoRecord = {
  id: string;
  content: string;
  createdAt: string;
};

export type CreateDemoRecordRequest = {
  content: string;
};

export type ListDemoRecordsResponse = ApiSuccess<DemoRecord[]> | ApiFailure;
export type CreateDemoRecordResponse = ApiSuccess<DemoRecord> | ApiFailure;
