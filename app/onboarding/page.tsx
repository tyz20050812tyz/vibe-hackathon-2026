import { CatalogHeader } from "@/components/resources/catalog-header";
import { OnboardingForm } from "@/components/reader-profile/onboarding-form";

export default function OnboardingPage() {
  return <div className="min-h-screen bg-[#fff8e9] text-[#172d29]"><CatalogHeader /><main className="mx-auto max-w-3xl px-5 py-10 sm:px-8"><p className="text-sm text-[#a23b2c]">阅读偏好</p><h1 className="mt-2 font-serif text-4xl">让下一条线索更贴近你</h1><p className="mt-4 max-w-xl leading-7 text-[#45554f]">选择你愿意反复阅读的主题，再告诉我们你愿意偏离多远。偏好只用于排序和发现，不会改变公共目录。</p><OnboardingForm /></main></div>;
}
