"use client";

import Link from "next/link";
import { useState } from "react";
import { ExternalLinkIcon, TagIcon, Undo2Icon } from "lucide-react";
import { Badge } from "@/components/Badge";
import { cn } from "@/utils";
import type { CleanThread } from "@/utils/redis/clean.types";
import { formatShortDate } from "@/utils/date";
import { Button } from "@/components/ui/button";
import { undoCleanInboxAction } from "@/utils/actions/clean";
import { isActionError } from "@/utils/error";
import { toastError } from "@/components/Toast";
import { getGmailUrl } from "@/utils/url";

type Status = "archived" | "archiving" | "keep" | "labelled";

export function EmailItem({
  email,
  userEmail,
}: {
  email: CleanThread;
  userEmail: string;
}) {
  const status = getStatus(email);
  const pending = isPending(email);
  const archive = email.archive === true;
  const label = !!email.label;

  return (
    <div
      className={cn(
        "flex items-center rounded-md border p-2 text-sm transition-all duration-300",
        pending && "border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/20",
        archive && "border-green-500/30",
        label && "border-yellow-500/30",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center">
          <StatusCircle status={status} />
          <div className="truncate font-medium">{email.subject}</div>
          <Link
            className="ml-2 hover:text-foreground"
            href={getGmailUrl(email.threadId, userEmail)}
            target="_blank"
          >
            <ExternalLinkIcon className="size-3" />
          </Link>
        </div>
        <div className="truncate text-xs text-muted-foreground">
          From: {email.from} • {formatShortDate(email.date)}
        </div>
      </div>

      <div className="ml-2 flex items-center space-x-2">
        <StatusBadge status={status} email={email} />
      </div>
    </div>
  );
}

function StatusCircle({ status }: { status: Status }) {
  return (
    <div
      className={cn(
        "mr-2 size-2 rounded-full",
        (status === "archived" || status === "archiving") && "bg-green-500",
        status === "keep" && "bg-blue-500",
        status === "labelled" && "bg-yellow-500",
      )}
    />
  );
}

function StatusBadge({
  status,
  email,
}: {
  status: Status;
  email: CleanThread;
}) {
  const [undone, setUndone] = useState(false);

  if (undone) {
    return <Badge color="purple">Undone</Badge>;
  }

  if (status === "archived" || status === "archiving") {
    return (
      <div className="group">
        <span className="group-hover:hidden">
          <Badge color="green">
            {status === "archiving" ? "Archiving..." : "Archived"}
          </Badge>
        </span>
        <div className="hidden group-hover:inline-flex">
          <Button
            size="xs"
            variant="ghost"
            onClick={async () => {
              if (undone) return;

              const result = await undoCleanInboxAction({
                threadId: email.threadId,
                archived: !!email.archive,
              });

              if (isActionError(result)) {
                toastError({ description: result.error });
              } else {
                setUndone(true);
              }
            }}
          >
            <Undo2Icon className="size-3" />
            Undo
          </Button>
        </div>
      </div>
    );
  }

  if (status === "keep") {
    return <Badge color="blue">Keep</Badge>;
  }

  if (status === "labelled") {
    return <Badge color="yellow">{email.label}</Badge>;
  }
}

function getStatus(email: CleanThread): Status {
  if (email.archive) {
    if (email.status === "processing") return "archiving";
    return "archived";
  }

  if (email.label) {
    return "labelled";
  }

  return "keep";
}

function isPending(email: CleanThread) {
  return email.status === "processing" || email.status === "applying";
}
