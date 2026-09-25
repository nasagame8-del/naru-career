"""Safety gate tests; no network, credentials, paid API, or merges."""
import copy
import datetime as dt
import struct
import unittest
from zoneinfo import ZoneInfo

from scripts.naru_scheduled_publish import (
    Hold, NoQueue, JST, planned_at, release, select_item, webp_size, within_window,
)

DAY = "2026-09-26"
SHA = "a" * 40


def fixture(order=1, slot="noon"):
    hour = {"noon": 12, "evening": 18}[slot]
    return {"selectedAt": DAY,
            "items": [{"order": order, "status": "USER_PREVIEW_APPROVED_AWAITING_SCHEDULED_PUBLICATION",
                       "headSha": SHA, "prNumber": 35, "slug": "sample-article",
                       "title": "サンプル記事",
                       "qa": {"previewApproved": True,
                              "previewVisual": "user_confirmed",
                              "previewApprovedBy": "user",
                              "githubActions": "success",
                              "vercelPreviewStatus": "success",
                              "frontmatter": True,
                              "bodyImageRefs": True,
                              "githubBlobByteVerified": True,
                              "previewApprovedAt": "%sT11:00:00+09:00" % DAY,
                              "scheduledPublishAt": "%sT%02d:00:00+09:00" % (DAY, hour)} }]}


class SelectionTests(unittest.TestCase):
    def test_noon_approved(self):
        self.assertEqual(select_item(fixture(), DAY, "noon")["headSha"], SHA)

    def test_evening_approved(self):
        data = fixture(2, "evening")
        data["items"][0]["qa"]["previewApprovedAt"] = DAY + "T17:30:00+09:00"
        self.assertEqual(select_item(data, DAY, "evening")["prNumber"], 35)

    def test_wrong_day_holds(self):
        with self.assertRaises(Hold):
            select_item(fixture(), "2026-09-27", "noon")

    def test_no_selection_skips(self):
        with self.assertRaises(NoQueue):
            select_item(fixture(), DAY, "evening")

    def test_already_published_skips(self):
        data = fixture()
        data["items"][0]["status"] = "PUBLISHED"
        with self.assertRaises(NoQueue):
            select_item(data, DAY, "noon")

    def test_no_approval_holds(self):
        data = fixture()
        data["items"][0]["qa"]["previewApproved"] = False
        with self.assertRaises(Hold):
            select_item(data, DAY, "noon")

    def test_approval_sha_mismatch_holds(self):
        data = fixture()
        data["items"][0]["qa"]["previewApprovedHeadSha"] = "b" * 40
        with self.assertRaises(Hold):
            select_item(data, DAY, "noon")

    def test_wrong_scheduled_slot_holds(self):
        data = fixture()
        data["items"][0]["qa"]["scheduledPublishAt"] = DAY + "T18:00:00+09:00"
        with self.assertRaises(Hold):
            select_item(data, DAY, "noon")

    def test_late_user_approval_holds(self):
        data = fixture()
        data["items"][0]["qa"]["previewApprovedAt"] = DAY + "T13:00:00+09:00"
        with self.assertRaises(Hold):
            select_item(data, DAY, "noon")

    def test_unexpected_status_holds(self):
        data = fixture()
        data["items"][0]["status"] = "MERGED_PRODUCTION_PENDING"
        with self.assertRaises(Hold):
            select_item(data, DAY, "noon")

    def test_invalid_slug_holds(self):
        data = fixture()
        data["items"][0]["slug"] = "../secret"
        with self.assertRaises(Hold):
            select_item(data, DAY, "noon")


class TimeTests(unittest.TestCase):
    def test_slot_is_jst(self):
        self.assertEqual(planned_at(DAY, "noon").utcoffset(), dt.timedelta(hours=9))

    def test_no_premature_merge(self):
        s = planned_at(DAY, "noon")
        self.assertFalse(within_window(s - dt.timedelta(seconds=1), s))

    def test_no_late_merge(self):
        s = planned_at(DAY, "noon")
        self.assertFalse(within_window(s + dt.timedelta(minutes=11), s))
        self.assertTrue(within_window(s + dt.timedelta(minutes=9), s))


class ImageTests(unittest.TestCase):
    @staticmethod
    def vp8x(w, h):
        return (b"RIFF" + b"\0" * 4 + b"WEBP" + b"VP8X"
                + struct.pack("<I", 10) + b"\0" * 4
                + (w - 1).to_bytes(3, "little") + (h - 1).to_bytes(3, "little"))

    def test_vp8x_dimensions(self):
        self.assertEqual(webp_size(self.vp8x(1200, 630)), (1200, 630))

    def test_vp8_dimensions(self):
        b = (b"RIFF" + b"\0" * 4 + b"WEBP" + b"VP8 " +
             struct.pack("<I", 10) + b"\0" * 3 + b"\x9d\x01\x2a"
             + struct.pack("<HH", 1200, 675))
        self.assertEqual(webp_size(b), (1200, 675))

    def test_vp8l_dimensions(self):
        bits = (1199 | 674 << 14)
        b = (b"RIFF" + b"\0" * 4 + b"WEBP" + b"VP8L"
             + struct.pack("<I", 6) + b"\x2f" + struct.pack("<I", bits)
             + b"\0" * 5)
        self.assertEqual(webp_size(b), (1200, 675))

    def test_rejects_fake_webp(self):
        with self.assertRaises(Hold):
            webp_size(b"not really a webp")


class DryRunTests(unittest.TestCase):
    def test_dry_run_does_not_mutate(self):
        class FakeClient:
            def __init__(self):
                self.mutations = 0
            def queue(self, date):
                return fixture(), "blobsha"
            def verify(self, item, day):
                return {"number": 35}, "title: sample"
            def merge(self, number, sha):
                self.mutations += 1
                raise AssertionError("Dry-run cannot merge")
            def mark_ready(self, pr):
                self.mutations += 1
                raise AssertionError("Dry-run cannot change Draft")
        f = FakeClient()
        release(f, DAY, "noon", dry_run=True)
        self.assertEqual(f.mutations, 0)


if __name__ == "__main__":
    unittest.main()
