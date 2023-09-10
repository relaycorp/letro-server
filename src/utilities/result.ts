interface BaseResult {
  readonly didSucceed: boolean;
}

type FailureResult<Reason> = Reason extends undefined
  ? BaseResult & { readonly didSucceed: false }
  : BaseResult & { readonly didSucceed: false; readonly context: Reason };

type SuccessfulResult<Result> = Result extends undefined
  ? BaseResult & { readonly didSucceed: true }
  : BaseResult & { readonly didSucceed: true; readonly result: Result };

export type Result<Type, FailureReason> = FailureResult<FailureReason> | SuccessfulResult<Type>;
