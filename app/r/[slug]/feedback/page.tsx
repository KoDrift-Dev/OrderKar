'use client';

// Public reviews page: /r/[slug]/feedback. Anyone (e.g. via the reviews QR)
// can leave a star rating + comment. Recent reviews are shown below.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTenant } from '@/components/TenantProvider';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import type { Review } from '@/lib/types';
import { fmtAgo } from '@/lib/format';
import { Btn, Card, Empty, Input, Textarea, SectionHead } from '@/components/ui';
import { LangProvider, normalizeLang, useT, type Lang } from '@/lib/i18n';
import ThemeToggle from '@/components/ThemeToggle';
import Logo from '@/components/Logo';

function Stars({ value, onPick, size = 34 }: { value: number; onPick?: (n: number) => void; size?: number }) {
  return (
    <div className="flex gap-1.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          disabled={!onPick}
          onClick={() => onPick?.(s)}
          aria-label={`${s} star${s > 1 ? 's' : ''}`}
          className={onPick ? 'transition-transform hover:scale-110' : ''}
        >
          <svg width={size} height={size} viewBox="0 0 24 24" fill={s <= value ? '#F59E0B' : 'none'} stroke={s <= value ? '#F59E0B' : 'var(--c-muted)'} strokeWidth="1.8" strokeLinejoin="round">
            <path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.3L12 17.1l-5.7 3.1 1.2-6.3L2.8 9.5l6.4-.8z" />
          </svg>
        </button>
      ))}
    </div>
  );
}

function useTenantLang(): Lang {
  const tenant = useTenant();
  const tc = (tenant.theme_config ?? {}) as Record<string, unknown>;
  return normalizeLang(tc.language);
}

export default function FeedbackPage() {
  return (
    <LangProvider value={useTenantLang()}>
      <FeedbackInner />
    </LangProvider>
  );
}

function FeedbackInner() {
  const tenant = useTenant();
  const t = useT();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [name, setName] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('reviews')
      .select('*')
      .eq('restaurant_id', tenant.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setReviews((data ?? []) as Review[]);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant.id]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !isSupabaseConfigured()) return;
    setBusy(true);
    setError('');
    try {
      const supabase = createClient();
      const { error } = await supabase.from('reviews').insert({
        restaurant_id: tenant.id,
        rating,
        comment: comment.trim() || null,
        customer_name: name.trim() || null,
      });
      if (error) throw new Error(error.message);
      setDone(true);
      setComment('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('fb_err_submit'));
    } finally {
      setBusy(false);
    }
  };

  const avg = reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href={`/r/${tenant.slug}`} className="flex items-center gap-2.5">
          <Logo size={36} />
          <span className="font-display text-[15px] font-extrabold text-ink">{tenant.name}</span>
        </Link>
        <ThemeToggle />
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
        <div className="pt-6 text-center">
          <h1 className="font-display text-3xl font-extrabold text-ink">{t('fb_title')}</h1>
          <p className="mt-2 text-muted">{t('fb_sub', { name: tenant.name })}</p>
          {reviews.length > 0 && (
            <p className="mt-3 font-mono text-lg font-bold text-ink">
              ★ {avg.toFixed(1)} <span className="text-sm font-sans font-semibold text-muted">{t('fb_reviews_count', { n: reviews.length })}</span>
            </p>
          )}
        </div>

        <Card deep className="mt-8 p-6 sm:p-8">
          {done ? (
            <div className="py-6 text-center">
              <p className="text-5xl">🙏</p>
              <h2 className="mt-4 font-display text-2xl font-extrabold text-ink">{t('fb_thanks')}</h2>
              <p className="mt-2 text-muted">{t('fb_recorded')}</p>
              <Btn variant="secondary" className="mt-5" onClick={() => setDone(false)}>
                {t('fb_another')}
              </Btn>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              <div>
                <p className="mb-2 text-[13px] font-bold text-body">{t('fb_rating')}</p>
                <Stars value={rating} onPick={setRating} />
              </div>
              <div>
                <p className="mb-1.5 text-[13px] font-bold text-body">{t('fb_name')}</p>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ahmed" />
              </div>
              <div>
                <p className="mb-1.5 text-[13px] font-bold text-body">{t('fb_comment')}</p>
                <Textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t('fb_comment_ph')} />
              </div>
              {error && <p className="text-sm font-bold text-danger">{error}</p>}
              <Btn type="submit" size="lg" className="w-full" disabled={busy}>
                {busy ? t('fb_submitting') : t('fb_submit')}
              </Btn>
            </form>
          )}
        </Card>

        <div className="mt-10">
          <SectionHead title={t('fb_recent')} sub={t('fb_shown', { n: reviews.length })} />
          {reviews.length === 0 ? (
            <Empty title={t('fb_no_reviews')} sub={t('fb_no_reviews_sub')} />
          ) : (
            <div className="space-y-3">
              {reviews.map((r) => (
                <Card key={r.id} className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <Stars value={r.rating} size={16} />
                    <span className="text-xs font-semibold text-muted">
                      {r.customer_name ? `${r.customer_name} · ` : ''}{fmtAgo(r.created_at)}
                    </span>
                  </div>
                  {r.comment && <p className="mt-2 text-[14px] leading-relaxed text-body">{r.comment}</p>}
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
