import type { Dictionary } from "../en";

type AiReview = Pick<Dictionary, "aiReview">;

export const aireviewFa: AiReview = {
  aiReview: {
    title: "بازبینی هوش مصنوعی",
    subtitle:
      "آنچه هوش مصنوعی نوشته و دسته‌هایی که پیشنهاد داده را بازبینی کنید. تا نپذیرید، هیچ‌چیز در ارقام شما تغییر نمی‌کند.",
    tabInsights: "توضیحات",
    tabSuggestions: "پیشنهاد دسته",
    tabsLabel: "نماهای بازبینی هوش مصنوعی",
    insightsEmptyTitle: "هنوز توضیحی از هوش مصنوعی نیست",
    insightsEmptyBody: "یک هشدار هزینه را باز کنید و «توضیح این هشدار» را بزنید.",
    openFlags: "هشدارهای هزینه",
    colSubject: "درباره",
    colGenerated: "زمان تولید",
    colReview: "بازبینی",
    colConfidence: "اطمینان",
    subjectFlag: "هشدار هزینه",
    suggestionsEmptyTitle: "پیشنهادی در انتظار نیست",
    suggestionsEmptyBody: "یک دور پیشنهاد اجرا کنید تا برای رکوردهای بدون دسته، دسته پیشنهاد شود.",
    suggestStatus: "وضعیت",
    suggestRun: "پیشنهاد دسته",
    suggestRunning: "در حال اجرا…",
    suggestDone: "{created} پیشنهاد از {considered} رکورد ایجاد شد.",
    suggestNone: "از {considered} رکورد پیشنهاد تازه‌ای ایجاد نشد.",
    suggestUnavailable: "سرویس هوش مصنوعی اکنون در دسترس نیست، بنابراین پیشنهادی ایجاد نشد.",
    colRecord: "رکورد",
    colSuggested: "دسته پیشنهادی",
    colWhy: "دلیل",
    colActions: "تصمیم",
    accept: "پذیرش",
    reject: "رد",
    accepted: "پیشنهاد پذیرفته شد. رکورد اکنون این دسته را دارد.",
    rejected: "پیشنهاد رد شد.",
    suggestionNote: "پیشنهادهای هوش مصنوعی فقط پس از پذیرش شما اعمال می‌شوند.",
    panelRejected:
      "خروجی هوش مصنوعی از بررسی‌های ما نگذشت و نمایش داده نمی‌شود. ارقام مبتنی بر قاعده تغییری نکرده‌اند.",
    panelInsufficient: "شواهد تأییدشده کافی برای توضیح این مورد وجود ندارد.",
    evidenceIds: "شناسه رکوردها",
    reviewedBadge: "بازبینی‌شده",
    needsReviewBadge: "هنوز کسی این را بازبینی نکرده است",
  },
};
