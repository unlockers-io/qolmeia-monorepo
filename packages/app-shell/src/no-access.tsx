import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { ShieldAlert } from "lucide-react";

import { SignOutButton } from "./sign-out-button";
import { MAIN_CONTENT_ID } from "./skip-link";

type NoAccessProps = {
  description: string;
  title: string;
};

const NoAccess = ({ description, title }: NoAccessProps) => (
  <main
    className="flex min-h-dvh items-center justify-center bg-background px-4 py-12"
    id={MAIN_CONTENT_ID}
  >
    <Card className="w-full max-w-md">
      <CardHeader>
        <div
          aria-hidden
          className="mb-1 flex size-10 items-center justify-center rounded-full bg-warning-surface text-warning-surface-foreground ring-1 ring-warning/20 [&_svg]:size-5"
        >
          <ShieldAlert />
        </div>
        <CardTitle className="text-2xl">
          <h1>{title}</h1>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <SignOutButton className="w-full" label="Sair desta conta" />
      </CardContent>
    </Card>
  </main>
);

export { NoAccess };
