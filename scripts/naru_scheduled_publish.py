#!/usr/bin/env python3
"""Fail-closed, no-paid-API NARU release gate. Runs only after user preview approval.

Schedules are 11:55/17:55 JST; the script waits until 12:00/18:00 to merge.
The GitHub workflow on master, not an article PR, owns this code.
"""
import argparse
import base64
import datetime as dt
import html
import json
import os
import re
import struct
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from zoneinfo import ZoneInfo

JST = ZoneInfo("Asia/Tokyo")
REPO = "nasagame8-del/naru-career"
QUEUE_BRANCH = "article-factory/candidates"
SITE = "https://naru-career.com"
SLOTS = {"noon": (1, 12), "evening": (2, 18)}
READY_STATUS = "USER_PREVIEW_APPROVED_AWAITING_SCHEDULED_PUBLICATION"
HEX_SHA = re.compile(r"[0-9a-f]{40}\Z")
SLUG = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*\Z")


class Hold(Exception):
    """A mandatory release gate failed; do not merge."""


class NoQueue(Exception):
    """There is no selection for this date; do not generate an alert."""


def now_jst():
    return dt.datetime.now(JST)


def planned_at(date_string, slot):
    return dt.datetime.combine(
        dt.date.fromisoformat(date_string), dt.time(SLOTS[slot][1]), JST
    )


def within_window(moment, scheduled):
    return scheduled <= moment <= scheduled + dt.timedelta(minutes=10)


def decode_content(obj):
    if obj.get("type") != "file" or obj.get("encoding") != "base64":
        raise Hold("GitHub contents response is not a base64 file")
    return base64.b64decode(obj["content"], validate=False)


def webp_size(blob):
    """Read dimensions directly from WebP headers; do not trust extensions."""
    if len(blob) < 30 or blob[:4] != b"RIFF" or blob[8:12] != b"WEBP":
        raise Hold("Invalid WebP RIFF header")
    kind = blob[12:16]
    if kind == b"VP8X":
        return (1 + int.from_bytes(blob[24:27], "little"),
                1 + int.from_bytes(blob[27:30], "little"))
    if kind == b"VP8 ":
        if blob[23:26] != b"\x9d\x01\x2a":
            raise Hold("Invalid VP8 frame header")
        return (struct.unpack_from("<H", blob, 26)[0] & 0x3fff,
                struct.unpack_from("<H", blob, 28)[0] & 0x3fff)
    if kind == b"VP8L":
        if blob[20] != 0x2f:
            raise Hold("Invalid VP8L frame header")
        bits = int.from_bytes(blob[21:25], "little")
        return ((bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1)
    raise Hold("Unsupported WebP frame type")


def select_item(queue, date_string, slot):
    order, hour = SLOTS[slot]
    if queue.get("selectedAt") != date_string:
        raise Hold("Queue selectedAt differs from schedule date")
    matching = [a for a in queue.get("items", []) if a.get("order") == order]
    if not matching:
        raise NoQueue("No selected article for this slot")
    if len(matching) != 1:
        raise Hold("Ambiguous selected order")
    item = matching[0]
    if item.get("status") == "PUBLISHED":
        raise NoQueue("Already published; skipping")
    if item.get("status") != READY_STATUS:
        raise Hold("Article is not in preview-approved, release-ready status")
    approved = item.get("qa") or {}
    if (approved.get("previewApproved") is not True
            or approved.get("previewVisual") != "user_confirmed"
            or approved.get("previewApprovedBy") != "user"
            or approved.get("githubActions") != "success"
            or approved.get("vercelPreviewStatus") != "success"
            or approved.get("frontmatter") is not True
            or approved.get("bodyImageRefs") is not True
            or approved.get("githubBlobByteVerified") is not True):
        raise Hold("Saved article QA or explicit user approval is missing")
    expected_sha = item.get("headSha", "")
    approved_sha = approved.get("previewApprovedHeadSha")
    if not HEX_SHA.fullmatch(expected_sha) or approved_sha != expected_sha:
        raise Hold("Approved head SHA mismatch or malformed SHA")
    if not SLUG.fullmatch(item.get("slug", "")):
        raise Hold("Invalid slug")
    if not isinstance(item.get("prNumber"), int) or item["prNumber"] < 1:
        raise Hold("Invalid PR number")
    when = approved.get("scheduledPublishAt")
    try:
        planned = dt.datetime.fromisoformat(when)
        approved_at = dt.datetime.fromisoformat(approved["previewApprovedAt"])
    except (TypeError, ValueError, KeyError) as exc:
        raise Hold("Invalid or missing schedule/approval timestamp") from exc
    if (planned.tzinfo is None or planned.astimezone(JST) != planned_at(date_string, slot)
            or approved_at.tzinfo is None or approved_at > planned):
        raise Hold("Schedule or preview approval timing mismatch")
    return item


class GitHub:
    def __init__(self, token, repo=REPO):
        if not token:
            raise Hold("GitHub Actions token not present")
        if repo != REPO:
            raise Hold("Release workflow is restricted to the NARU repository")
        self.token = token
        self.repo = repo

    def request(self, path, method="GET", payload=None):
        url = "https://api.github.com/" + path.lstrip("/")
        data = json.dumps(payload, ensure_ascii=False).encode() if payload is not None else None
        req = urllib.request.Request(
            url, data=data, method=method,
            headers={"Authorization": "Bearer " + self.token,
                     "Accept": "application/vnd.github+json",
                     "X-GitHub-Api-Version": "2022-11-28",
                     "User-Agent": "NARU-safe-scheduled-publisher",
                     "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=25) as resp:
                return json.loads(resp.read().decode())
        except urllib.error.HTTPError as exc:
            if exc.code == 404 and "/contents/data/article-candidates/" in path:
                raise NoQueue("Today's selected queue does not exist") from exc
            raise Hold("GitHub API HTTP %s on %s" % (exc.code, method)) from exc
        except (urllib.error.URLError, TimeoutError) as exc:
            raise Hold("GitHub API network error") from exc

    def get(self, path):
        return self.request(path)

    def queue(self, day):
        path = ("repos/%s/contents/data/article-candidates/selected-queue-%s.json"
                "?ref=%s" % (self.repo, day, QUEUE_BRANCH))
        obj = self.get(path)
        return json.loads(decode_content(obj)), obj["sha"]

    def pr(self, number):
        return self.get("repos/%s/pulls/%d" % (self.repo, number))

    def verify(self, item, day):
        number = item["prNumber"]
        sha = item["headSha"]
        pr = self.pr(number)
        if (pr["state"] != "open" or pr.get("merged_at") is not None
                or pr["base"]["ref"] != "master"
                or pr["head"]["sha"] != sha
                or pr["head"]["repo"]["full_name"] != self.repo
                or pr.get("mergeable") is not True):
            raise Hold("PR not open/mergeable, foreign head, or approved SHA changed")
        files = self.get("repos/%s/pulls/%d/files?per_page=100" % (self.repo, number))
        if len(files) >= 100:
            raise Hold("PR has too many changed files to verify safely")
        changed = {f["filename"] for f in files}
        slug = item["slug"]
        article_path = "content/articles/%s.md" % slug
        paths = ["public/images/articles/%s-%s.webp" % (slug, x)
                 for x in ("card", "01", "02", "03")]
        if article_path not in changed or not set(paths).issubset(changed):
            raise Hold("Article or 4 WebP files missing from the same PR")
        if not any(p.startswith("data/article-runs/") and p.endswith("-image-plan.md")
                   for p in changed):
            raise Hold("Article-specific image plan missing from PR")
        md = decode_content(self.get("repos/%s/contents/%s?ref=%s"
                                     % (self.repo, article_path, sha))).decode()
        if not md.startswith("---\n") or "\n---\n" not in md[4:]:
            raise Hold("Article frontmatter missing")
        frontmatter, body = md[4:].split("\n---\n", 1)
        must = ("title", "category", "keyword", "datePublished", "dateModified",
                "excerpt", "summary", "faq", "cta_agents", "note_published")
        for k in must:
            if not re.search(r"^" + k + r"\s*:", frontmatter, re.M):
                raise Hold("Missing frontmatter field: " + k)
        published = re.search(r"^datePublished:\s*[\"']?(\d{4}-\d{2}-\d{2})", frontmatter, re.M)
        if not published or published.group(1) != day:
            raise Hold("datePublished does not match the intended release day")
        for slot in ("01", "02", "03"):
            pattern = (r"!\[[^\]\r\n]{4,}\]\(/images/articles/"
                       + re.escape(slug) + "-" + slot + r"\.webp\)")
            if not re.search(pattern, body):
                raise Hold("Missing body image reference/alt: " + slot)
        if body.count("\n## ") < 3:
            raise Hold("Article has insufficient H2 structure")
        for i, path in enumerate(paths):
            pic = decode_content(self.get("repos/%s/contents/%s?ref=%s"
                                           % (self.repo, path, sha)))
            if len(pic) < 5000 or webp_size(pic) != ((1200, 630) if i == 0 else (1200, 675)):
                raise Hold("Image bytes or dimensions invalid: " + path)
        runs = self.get("repos/%s/actions/workflows/article-factory-validation.yml/runs"
                        "?head_sha=%s&event=pull_request&per_page=20" % (self.repo, sha))
        if not any(r.get("head_sha") == sha and r.get("status") == "completed"
                   and r.get("conclusion") == "success"
                   for r in runs.get("workflow_runs", [])):
            raise Hold("Latest PR-head Article Factory Validation has not passed")
        status = self.get("repos/%s/commits/%s/status" % (self.repo, sha))
        vercel = next((s for s in status.get("statuses", [])
                       if s.get("context") == "Vercel"), None)
        if not vercel or vercel.get("state") != "success":
            raise Hold("PR-head Vercel Preview commit status is not success")
        return pr, frontmatter

    def write_queue(self, day, queue, expected_sha):
        path = "data/article-candidates/selected-queue-%s.json" % day
        payload = {"branch": QUEUE_BRANCH, "sha": expected_sha,
                   "message": "chore: record checked NARU scheduled publication",
                   "content": base64.b64encode(
                       (json.dumps(queue, ensure_ascii=False, indent=2) + "\n").encode()
                   ).decode()}
        self.request("repos/%s/contents/%s" % (self.repo, path), "PUT", payload)
        confirm, sha = self.queue(day)
        return confirm, sha

    def mark_ready(self, pr):
        if not pr.get("draft"):
            return
        query = ("mutation($id:ID!){markPullRequestReadyForReview(input:"
                 "{pullRequestId:$id}){pullRequest{isDraft}}}")
        ret = self.request("graphql", "POST",
                           {"query": query, "variables": {"id": pr["node_id"]}})
        if ret.get("errors") or ret["data"]["markPullRequestReadyForReview"]["pullRequest"]["isDraft"]:
            raise Hold("Could not transition Draft PR to Ready")

    def merge(self, number, sha):
        resp = self.request("repos/%s/pulls/%d/merge" % (self.repo, number),
                            "PUT", {"sha": sha, "merge_method": "squash",
                                    "commit_title": "NARU article: scheduled approved release"})
        if resp.get("merged") is not True or not HEX_SHA.fullmatch(resp.get("sha", "")):
            raise Hold("GitHub did not confirm an exact-SHA squash merge")
        return resp["sha"]

    def production_success(self, sha):
        statuses = self.get("repos/%s/commits/%s/status" % (self.repo, sha))
        v = next((s for s in statuses.get("statuses", []) if s.get("context") == "Vercel"), None)
        if v and v.get("state") == "failure":
            raise Hold("Vercel Production failed for merge SHA")
        return bool(v and v.get("state") == "success")

    def notify_hold(self, day, slot, problem):
        title = "[NARU] %s %s 公開保留・要確認" % (day, slot)
        try:
            existing = self.get("repos/%s/issues?state=open&per_page=100" % self.repo)
            if any(x.get("title") == title and "pull_request" not in x for x in existing):
                return
            run = os.getenv("GITHUB_RUN_ID", "")
            body = ("予約公開が保留されました。自動的な遅延再投稿はしません。\n\n"
                    "原因: %s\n\n実行ログ: https://github.com/%s/actions/runs/%s\n"
                    "記事PRと承認済みhead SHAを確認してから手動で対応してください。\n"
                    % (problem, self.repo, run))
            self.request("repos/%s/issues" % self.repo, "POST",
                         {"title": title, "body": body, "assignees": ["nasagame8-del"]})
        except (Hold, NoQueue):
            print("Warning: could not create GitHub issue; inspect failed workflow logs",
                  file=sys.stderr)


def public_http_verified(slug, title):
    url = SITE + "/articles/" + slug
    req = urllib.request.Request(url, headers={"User-Agent": "NARU-release-QA/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=25) as response:
            if response.status != 200 or "text/html" not in response.headers.get("Content-Type", ""):
                return False
            page = html.unescape(response.read().decode("utf-8", "replace"))
        if title not in page:
            return False
        for part in ("card", "01", "02", "03"):
            name = "%s-%s.webp" % (slug, part)
            if name not in page:
                return False
            image_req = urllib.request.Request(
                SITE + "/images/articles/" + name,
                headers={"User-Agent": "NARU-release-QA/1.0", "Range": "bytes=0-31"})
            with urllib.request.urlopen(image_req, timeout=25) as image:
                if image.status not in (200, 206):
                    return False
                if "image/webp" not in image.headers.get("Content-Type", ""):
                    return False
                raw = image.read(32)
                if raw[:4] != b"RIFF" or raw[8:12] != b"WEBP":
                    return False
        return True
    except (urllib.error.URLError, TimeoutError):
        return False


def release(client, day, slot, dry_run):
    try:
        queue, queue_sha = client.queue(day)
        item = select_item(queue, day, slot)
    except NoQueue as exc:
        print("SKIP:", exc)
        return
    scheduled = planned_at(day, slot)
    if not dry_run and now_jst() > scheduled + dt.timedelta(minutes=10):
        raise Hold("GitHub schedule fired more than 10 minutes late")
    pr, _ = client.verify(item, day)
    print("Validated PR #%d at %s" % (item["prNumber"], item["headSha"]))
    if dry_run:
        print("DRY RUN: no PR, branch or queue was modified")
        return
    while now_jst() < scheduled:
        time.sleep(min(10.0, (scheduled - now_jst()).total_seconds()))
    if not within_window(now_jst(), scheduled):
        raise Hold("Publication window elapsed; automatic late merge forbidden")
    # A second read closes the race with editing/revoking user approval.
    fresh, fresh_sha = client.queue(day)
    again = select_item(fresh, day, slot)
    if again["headSha"] != item["headSha"] or fresh_sha != queue_sha:
        raise Hold("Queue changed after preflight; requires a fresh release decision")
    live_pr, _ = client.verify(again, day)
    client.mark_ready(live_pr)
    client.verify(again, day)
    merged_sha = client.merge(again["prNumber"], again["headSha"])
    print("MERGED:", merged_sha)
    merged_item = next(x for x in fresh["items"] if x["order"] == SLOTS[slot][0])
    merged_item["status"] = "MERGED_PRODUCTION_PENDING"
    merged_item["mergeSha"] = merged_sha
    merged_item["mergedAt"] = now_jst().isoformat(timespec="seconds")
    merged_item["productionUrl"] = SITE + "/articles/" + again["slug"]
    merged_item.setdefault("qa", {})["productionDeploymentStatus"] = "pending"
    fresh["notes"] = fresh.get("notes", []) + [
        "Scheduled release merged PR #%d at %s; production pending verification."
        % (again["prNumber"], merged_sha)]
    latest, pending_sha = client.write_queue(day, fresh, fresh_sha)
    pending = next(x for x in latest["items"] if x["order"] == SLOTS[slot][0])
    if pending.get("mergeSha") != merged_sha:
        raise Hold("Queue merge-SHA readback did not match")
    title = again["title"]
    for _ in range(32):  # up to about 8 minutes
        if client.production_success(merged_sha) and public_http_verified(again["slug"], title):
            latest2, latest_sha = client.queue(day)
            match = next(x for x in latest2["items"] if x["order"] == SLOTS[slot][0])
            if match.get("mergeSha") != merged_sha or match.get("status") != "MERGED_PRODUCTION_PENDING":
                raise Hold("Queue changed while waiting for production verification")
            match["status"] = "PUBLISHED"
            match["publishedVerificationAtJST"] = now_jst().isoformat(timespec="seconds")
            match.setdefault("qa", {}).update({
                "productionDeploymentStatus": "success_via_git_commit_status",
                "vercelMergeCommitStatus": "success",
                "productionDeployVerified": True,
                "publicArticleUrlVerified": True,
                "publicArticleUrlVerifiedBy": "github_actions_http",
                "productionVerificationMethod":
                    "Exact merge-SHA Vercel status success and live HTTP article/title/4 images"})
            final, _ = client.write_queue(day, latest2, latest_sha)
            verified = next(x for x in final["items"] if x["order"] == SLOTS[slot][0])
            if verified.get("status") != "PUBLISHED":
                raise Hold("Production confirmation could not be read back")
            print("PUBLISHED AND VERIFIED:", match["productionUrl"])
            return
        time.sleep(15)
    raise Hold("Merged, but Vercel/HTTP production verification not completed; do not remerge")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--slot", choices=SLOTS, required=True)
    p.add_argument("--date", help="JST YYYY-MM-DD; available only in dry-run")
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()
    if args.date and not args.dry_run:
        p.error("--date is only permitted for non-mutating dry-run")
    day = args.date or now_jst().date().isoformat()
    client = GitHub(os.environ.get("GH_TOKEN"), os.environ.get("GITHUB_REPOSITORY", REPO))
    try:
        release(client, day, args.slot, args.dry_run)
    except Hold as exc:
        print("HOLD:", str(exc), file=sys.stderr)
        if not args.dry_run:
            client.notify_hold(day, args.slot, str(exc))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
