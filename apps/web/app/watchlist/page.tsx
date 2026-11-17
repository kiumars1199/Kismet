import { Suspense } from "react";
import { MyList } from "@/components/watch/MyList";

export const metadata = { title: "My list" };

export default function Page() {
  return (
    <Suspense>
      <MyList />
    </Suspense>
  );
}
