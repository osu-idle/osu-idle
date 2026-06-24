import './News.css';

import {
	useEffect,
	useState,
} from 'react';
import {
	NEWS_TAGS,
	NEWS_TAG_NAMES,
	type NewsTag,
	type NewsDTO,
} from '@osu-idle/shared/news';

import {
	listAllNews,
	createNews,
	updateNews,
	deleteNews,
	formatDate,
	uploadNewsImage,
	mediaUrl,
} from '../../api/news';
import { formatChangelog } from './changelog';
import Link from '../../components/Link';

interface Draft {
	slug: string;
	title: string;
	summary: string;
	content: string;
	tag: NewsTag;
	imageUrl: string | null;
	published: boolean;
}
const EMPTY: Draft = {
	slug: '', title: '', summary: '', content: '', tag: 'update', imageUrl: null, published: false, 
};

const slugify = (s: string) =>
	s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);

export default function NewsAdmin() {
	const [list, setList] = useState<NewsDTO[] | null>(null);
	// null = still checking, false = denied, true = authorized.
	const [authorized, setAuthorized] = useState<boolean | null>(null);
	const [editingId, setEditingId] = useState<number | null>(null); // null = creating new
	const [draft, setDraft] = useState<Draft>(EMPTY);
	const [slugTouched, setSlugTouched] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [uploading, setUploading] = useState(false);

	// The server is the real gate - if listing drafts succeeds we're an admin.
	const refresh = () =>
		listAllNews()
			.then(rows => { setList(rows); setAuthorized(true); })
			.catch(e => { setAuthorized(false); setError(String(e.message ?? e)); });

	useEffect(() => { void refresh(); }, []);

	const editNew = () => { 
		setEditingId(null);
		setDraft(EMPTY);
		setSlugTouched(false); 
		setError(null);
	};
	const edit = (a: NewsDTO) => {
		setEditingId(a.id);
		setDraft({
			slug: a.slug, title: a.title, summary: a.summary, content: a.content, tag: a.tag, imageUrl: a.imageUrl, published: a.published, 
		});
		setSlugTouched(true);
		setError(null);
	};

	const onTitle = (title: string) =>
		setDraft(d => ({
			...d, title, slug: slugTouched ? d.slug : slugify(title), 
		}));

	const onPickImage = async (file: File | undefined) => {
		if (!file) return;
		setUploading(true);
		setError(null);
		try {
			const url = await uploadNewsImage(file);
			setDraft(d => ({
				...d, imageUrl: url, 
			}));
		} catch (e) {
			setError(String((e as Error).message ?? e));
		} finally {
			setUploading(false);
		}
	};

	const save = async (publish?: boolean) => {
		setSaving(true);
		setError(null);
		const body = {
			...draft, ...(publish === undefined ? {} : { published: publish }), 
		};
		try {
			if (editingId === null) await createNews(body);
			else await updateNews(editingId, body);
			editNew();
			await refresh();
		} catch (e) {
			setError(String((e as Error).message ?? e));
		} finally {
			setSaving(false);
		}
	};

	const remove = async (a: NewsDTO) => {
		if (!confirm(`Delete “${a.title}”? This cannot be undone.`)) return;
		try {
			await deleteNews(a.id);
			if (editingId === a.id) editNew();
			await refresh();
		} catch (e) {
			setError(String((e as Error).message ?? e));
		}
	};

	if (authorized === null) return <main className="page-contents">
		<p className="news-msg">Loading…</p>
	</main>;
	if (!authorized) {
		return (
			<main className="page-contents">
				<p className="news-msg news-msg--error">You don’t have access to this page.</p>
				<Link to="/news" className="news-back">← All news</Link>
			</main>
		);
	}

	return (
		<main className="page-contents">
			<Link to="/news" className="news-back">← All news</Link>

			<div className="news-admin__grid">
				{/* Existing articles */}
				<aside className="news-admin__list">
					<div className="news-admin__list-head">
						<span>Articles</span>
						<button type="button" className="news-btn news-btn--sm" onClick={editNew}>+ New</button>
					</div>
					{list?.length === 0 && <p className="news-msg news-msg--sm">Nothing published yet.</p>}
					{list?.map(a => (
						<div
							key={a.id}
							className={`news-admin__item ${editingId === a.id ? 'is-active' : ''}`}
							onClick={() => edit(a)}
						>
							<div className="news-admin__item-main">
								<span className="news-admin__item-title">{a.title}</span>
								<span className="news-admin__item-meta">
									<span className={`news-tag ${a.published ? 'is-published' : 'is-draft'}`}>
										{a.published ? 'published' : 'draft'}
									</span>
									{formatDate(a.publishedAt)}
								</span>
							</div>
							<button 
								type="button"
								className="news-admin__del" 
								onClick={e => {
									e.stopPropagation(); 
									void remove(a);
								}}
							>
								✕
							</button>
						</div>
					))}
				</aside>

				{/* Editor */}
				<form className="news-editor" onSubmit={e => { e.preventDefault(); void save(); }}>
					<h2 className="news-editor__heading">{editingId === null ? 'New article' : 'Edit article'}</h2>

					<label className="news-field">
						<span>Title</span>
						<input value={draft.title} onChange={e => onTitle(e.target.value)} required maxLength={200} />
					</label>

					<label className="news-field">
						<span>Slug</span>
						<input
							value={draft.slug}
							onChange={e => { setSlugTouched(true); setDraft(d => ({
								...d, slug: e.target.value, 
							})); }}
							required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={120}
						/>
						<small>Used in the URL: /news/{draft.slug || 'your-slug'}</small>
					</label>

					<label className="news-field">
						<span>Tag</span>
						<select value={draft.tag} onChange={e => setDraft(d => ({
							...d, tag: e.target.value as NewsTag, 
						}))}>
							{NEWS_TAG_NAMES.map(t => <option key={t} value={t}>{NEWS_TAGS[t].label}</option>)}
						</select>
						<small>Sets the card colour and the default cover.</small>
					</label>

					<div className="news-field">
						<span>Cover image</span>
						{draft.imageUrl ? (
							<div className="news-cover">
								<img className="news-cover__img" src={mediaUrl(draft.imageUrl)!} alt="" />
								<button type="button" className="news-btn news-btn--sm" onClick={() => setDraft(d => ({
									...d, imageUrl: null, 
								}))}>Remove</button>
							</div>
						) : (
							<input 
								type="file"
								accept="image/png,image/jpeg,image/webp,image/gif" 
								onChange={e => void onPickImage(e.target.files?.[0])} 
							/>
						)}
						<small>{uploading ? 'Uploading…' : 'Optional - falls back to the tag colour.'}</small>
					</div>

					<label className="news-field">
						<span>Summary</span>
						<textarea value={draft.summary} onChange={e => setDraft(d => ({
							...d, summary: e.target.value, 
						}))} required maxLength={500} rows={2} />
					</label>

					<div className="news-field">
						<div className="news-field__head">
							<span>Content (HTML)</span>
							<button
								type="button"
								className="news-btn news-btn--sm"
								onClick={() => setDraft(d => ({
									...d, content: formatChangelog(d.content), 
								}))}
							>
								Format changelog
							</button>
						</div>
						<textarea value={draft.content} onChange={e => setDraft(d => ({
							...d, content: e.target.value, 
						}))} required rows={14} className="news-field__code" />
						<small>
							HTML is supported - headings, links, &lt;img&gt;, embeds, etc.
							“Format changelog” turns a markdown changelog into HTML.
						</small>
					</div>

					{error && <p className="news-msg news-msg--error">{error}</p>}

					{/* The buttons drive the published state - no separate checkbox. A
					    published article gets save/unpublish; a draft gets save/publish. */}
					<div className="news-editor__actions">
						{draft.published ? (<>
							<button type="submit" className="news-btn" disabled={saving}>
								{saving ? 'Saving…' : 'Save changes'}
							</button>
							<button type="button" className="news-btn" disabled={saving} onClick={() => void save(false)}>
								Unpublish
							</button>
						</>) : (<>
							<button type="submit" className="news-btn" disabled={saving}>
								{saving ? 'Saving…' : 'Save draft'}
							</button>
							<button 
								type="button"
								className="news-btn news-btn--accent" 
								disabled={saving} 
								onClick={() => void save(true)}
							>
								Save &amp; publish
							</button>
						</>)}
					</div>
				</form>
			</div>
		</main>
	);
}
