import { redesignFragments } from "@/components/redesign/design-fragments";

type RedesignPageName = keyof typeof redesignFragments;

type RedesignPageProps = {
  name: RedesignPageName;
};

export function RedesignPage({ name }: RedesignPageProps) {
  return (
    <div
      className="contents"
      dangerouslySetInnerHTML={{ __html: redesignFragments[name] }}
    />
  );
}
