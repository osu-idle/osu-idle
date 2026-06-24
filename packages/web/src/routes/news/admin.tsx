import { createFileRoute } from '@tanstack/react-router';
import { msg } from '@lingui/core/macro';
import NewsAdmin from '../../pages/news/NewsAdmin';

export const Route = createFileRoute('/news/admin')({
	component: NewsAdmin,
	staticData: { title: msg`manage news` },
});
