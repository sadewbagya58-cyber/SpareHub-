"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Star,
  ShieldCheck,
  MessageSquare,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Lock,
  Loader2,
} from "lucide-react";
import {
  getProductReviewsAction,
  submitProductReviewAction,
  deleteProductReviewAction,
} from "@/lib/reviews/actions";
import type { ProductReviewItem, ProductRatingSummary } from "@/lib/types";
import { Button } from "@/components/ui/button";

interface ProductReviewsInitialData {
  reviews: ProductReviewItem[];
  summary: ProductRatingSummary;
  userCanReview: boolean;
  userReview?: ProductReviewItem | null;
}

interface ProductReviewsProps {
  productId: string;
  initialData?: ProductReviewsInitialData;
}

export function ProductReviews({ productId, initialData }: ProductReviewsProps) {
  const [reviews, setReviews] = useState<ProductReviewItem[]>(
    () => initialData?.reviews ?? []
  );
  const [summary, setSummary] = useState<ProductRatingSummary>(
    () =>
      initialData?.summary ?? {
        averageRating: 0,
        totalReviews: 0,
        distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
      }
  );
  const [userCanReview, setUserCanReview] = useState<boolean>(
    () => initialData?.userCanReview ?? false
  );
  const [userReview, setUserReview] = useState<ProductReviewItem | null>(
    () => initialData?.userReview ?? null
  );
  const [loading, setLoading] = useState<boolean>(() => !initialData);

  // Review Form State
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState<number>(
    () => initialData?.userReview?.rating ?? 5
  );
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [title, setTitle] = useState<string>(
    () => initialData?.userReview?.title || ""
  );
  const [comment, setComment] = useState<string>(
    () => initialData?.userReview?.comment || ""
  );
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadReviews = useCallback(async () => {
    try {
      const res = await getProductReviewsAction(productId);
      setReviews(res.reviews);
      setSummary(res.summary);
      setUserCanReview(res.userCanReview);
      if (res.userReview) {
        setUserReview(res.userReview);
        setRating(res.userReview.rating);
        setTitle(res.userReview.title || "");
        setComment(res.userReview.comment);
      }
    } catch (e) {
      console.error("Failed to load reviews:", e);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    // Skip mount-time Server Action POST when initialData was already preloaded on the server
    if (initialData) {
      return;
    }

    let isMounted = true;
    async function init() {
      try {
        const res = await getProductReviewsAction(productId);
        if (!isMounted) return;
        setReviews(res.reviews);
        setSummary(res.summary);
        setUserCanReview(res.userCanReview);
        if (res.userReview) {
          setUserReview(res.userReview);
          setRating(res.userReview.rating);
          setTitle(res.userReview.title || "");
          setComment(res.userReview.comment);
        }
      } catch (e) {
        console.error("Failed to load reviews:", e);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    init();
    return () => {
      isMounted = false;
    };
  }, [productId, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (comment.trim().length < 5) {
      setFormError("Review comment must be at least 5 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await submitProductReviewAction({
        productId,
        rating,
        title: title.trim() || undefined,
        comment: comment.trim(),
      });

      if (res.success) {
        setFormSuccess(res.message);
        setShowForm(false);
        loadReviews();
      } else {
        setFormError(res.message);
      }
    } catch {
      setFormError("An unexpected error occurred while submitting your review.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (reviewId: string) => {
    if (confirmDeleteId !== reviewId) {
      setConfirmDeleteId(reviewId);
      return;
    }
    setConfirmDeleteId(null);
    setDeletingId(reviewId);
    setActionError(null);

    try {
      const res = await deleteProductReviewAction(reviewId);
      if (res.success) {
        if (userReview?.id === reviewId) {
          setUserReview(null);
          setTitle("");
          setComment("");
          setRating(5);
        }
        loadReviews();
      } else {
        setActionError(res.message);
      }
    } catch {
      setActionError("Failed to delete review.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-sparehub-border p-6 sm:p-8 space-y-8 shadow-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-sparehub-border">
        <div>
          <h2 className="text-xl font-black text-sparehub-dark flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-sparehub-orange" />
            Verified Customer Reviews
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Genuine ratings and reviews from customers who purchased this specific spare part.
          </p>
        </div>

        {userCanReview && !showForm && (
          <Button
            onClick={() => setShowForm(true)}
            size="sm"
            className="bg-sparehub-dark hover:bg-neutral-800 text-white font-bold gap-1.5 self-start sm:self-auto"
          >
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
            {userReview ? "Edit Your Review" : "Write a Review"}
          </Button>
        )}
      </div>

      {/* Review Form Drawer / Box */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="p-5 rounded-2xl bg-amber-50/40 border border-amber-200/80 space-y-4 animate-in fade-in duration-200"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-sparehub-dark flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-sparehub-success" />
              {userReview ? "Update Your Review" : "Write a Verified Review"}
            </h3>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-xs text-gray-500 hover:text-sparehub-dark font-semibold"
            >
              Cancel
            </button>
          </div>

          {formError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{formError}</span>
            </div>
          )}

          {/* Star Rating Picker */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              Overall Rating *
            </label>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((star) => {
                const isFilled = (hoverRating ?? rating) >= star;
                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(null)}
                    className="p-1 rounded-md hover:bg-white transition-colors cursor-pointer"
                    aria-label={`${star} star`}
                  >
                    <Star
                      className={`w-6 h-6 transition-transform ${
                        isFilled
                          ? "text-amber-400 fill-amber-400 scale-110"
                          : "text-gray-300"
                      }`}
                    />
                  </button>
                );
              })}
              <span className="text-xs font-bold text-gray-600 ml-2">
                {rating === 5
                  ? "5 / 5 - Excellent"
                  : rating === 4
                  ? "4 / 5 - Good"
                  : rating === 3
                  ? "3 / 5 - Average"
                  : rating === 2
                  ? "2 / 5 - Below Average"
                  : "1 / 5 - Poor"}
              </span>
            </div>
          </div>

          {/* Headline */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Headline (Optional)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Perfect OEM fit for my 2018 Aqua, highly recommend!"
              maxLength={100}
              className="w-full text-xs rounded-xl border border-sparehub-border bg-white p-2.5 focus:border-sparehub-orange focus:outline-none"
            />
          </div>

          {/* Comment */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Detailed Feedback *
            </label>
            <textarea
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Describe the build quality, packaging, installation fitment, or vehicle performance..."
              minLength={5}
              maxLength={2000}
              required
              className="w-full text-xs rounded-xl border border-sparehub-border bg-white p-2.5 focus:border-sparehub-orange focus:outline-none"
            />
            <div className="flex justify-between text-[11px] text-gray-400 mt-1">
              <span>Minimum 5 characters</span>
              <span>{comment.length} / 2000</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              isLoading={submitting}
              loadingText="Submitting..."
              disabled={submitting}
              className="bg-sparehub-orange hover:bg-sparehub-orange-hover text-white font-bold"
            >
              {userReview ? "Save Changes" : "Publish Review"}
            </Button>
          </div>
        </form>
      )}

      {actionError && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 font-bold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-sparehub-error shrink-0" />
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-red-500 hover:text-red-700 text-xs font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {formSuccess && (
        <div className="p-3.5 rounded-xl bg-green-50 border border-green-200 text-xs text-green-800 font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-sparehub-success shrink-0" />
          <span>{formSuccess}</span>
        </div>
      )}

      {/* Ratings Summary & Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center bg-gray-50/70 rounded-2xl p-6 border border-sparehub-border">
        {/* Left: Overall Score */}
        <div className="md:col-span-4 text-center md:text-left space-y-2">
          <div className="flex items-baseline justify-center md:justify-start gap-2">
            <span className="text-4xl font-black text-sparehub-dark">
              {summary.averageRating > 0 ? summary.averageRating.toFixed(1) : "0.0"}
            </span>
            <span className="text-gray-400 text-sm font-semibold">/ 5.0</span>
          </div>

          <div className="flex items-center justify-center md:justify-start gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`w-4 h-4 ${
                  star <= Math.round(summary.averageRating)
                    ? "text-amber-400 fill-amber-400"
                    : "text-gray-300"
                }`}
              />
            ))}
          </div>

          <p className="text-xs text-gray-500 font-medium">
            Based on {summary.totalReviews} verified {summary.totalReviews === 1 ? "review" : "reviews"}
          </p>
        </div>

        {/* Right: Distribution Bars */}
        <div className="md:col-span-8 space-y-2">
          {[5, 4, 3, 2, 1].map((stars) => {
            const count = summary.distribution[stars as keyof typeof summary.distribution] || 0;
            const percentage =
              summary.totalReviews > 0
                ? Math.round((count / summary.totalReviews) * 100)
                : 0;

            return (
              <div key={stars} className="flex items-center gap-3 text-xs">
                <span className="w-12 font-bold text-gray-600 shrink-0 flex items-center gap-1">
                  {stars} <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                </span>
                <div className="flex-1 h-2 rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all duration-300"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className="w-10 text-right text-gray-400 font-mono text-[11px] shrink-0">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Review Eligibility Info Notice */}
      {!userCanReview && (
        <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-600 flex items-start gap-3">
          <Lock className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
          <div>
            <strong className="block text-gray-800 font-semibold mb-0.5">
              Verified Buyer Reviews Only
            </strong>
            <span>
              To maintain marketplace integrity and prevent fake feedback, only customers who have purchased this item and received it can submit a review.
            </span>
          </div>
        </div>
      )}

      {/* Reviews List */}
      <div className="space-y-4">
        <h3 className="font-bold text-sm text-sparehub-dark">
          Customer Feedback ({reviews.length})
        </h3>

        {loading ? (
          <div className="p-8 text-center text-xs text-gray-400 animate-pulse">
            Loading reviews...
          </div>
        ) : reviews.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-gray-200 rounded-2xl">
            <Star className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-gray-600">No customer reviews yet</p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Have you installed this part? Share your verified feedback after purchase!
            </p>
          </div>
        ) : (
          <div className="space-y-4 divide-y divide-gray-100">
            {reviews.map((rev) => (
              <div key={rev.id} className="pt-4 first:pt-0 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-sparehub-dark">
                        {rev.customerName}
                      </span>
                      {rev.isVerifiedPurchase && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-1.5 py-0.5 rounded-full">
                          <ShieldCheck className="w-3 h-3 text-emerald-600" />
                          Verified Buyer
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-3.5 h-3.5 ${
                              s <= rev.rating
                                ? "text-amber-400 fill-amber-400"
                                : "text-gray-200"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-[11px] text-gray-400">
                        {new Date(rev.createdAt).toLocaleDateString("en-LK", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  </div>

                  {userReview?.id === rev.id && (
                    <button
                      type="button"
                      disabled={deletingId === rev.id}
                      onClick={() => handleDelete(rev.id)}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50 ${
                        confirmDeleteId === rev.id
                          ? "bg-red-100 text-red-700 font-bold text-[10px] px-2"
                          : "text-gray-400 hover:text-red-600 hover:bg-red-50"
                      }`}
                      title="Delete your review"
                    >
                      {deletingId === rev.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-red-600" />
                      ) : confirmDeleteId === rev.id ? (
                        "Confirm?"
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>

                {rev.title && (
                  <h4 className="text-xs font-bold text-sparehub-dark">{rev.title}</h4>
                )}

                <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-line">
                  {rev.comment}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
