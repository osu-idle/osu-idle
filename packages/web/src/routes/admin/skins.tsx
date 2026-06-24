import { createFileRoute } from '@tanstack/react-router';
import { msg } from '@lingui/core/macro';
import SkinsAdmin from '../../pages/admin/Skins';

export const Route = createFileRoute('/admin/skins')({
	component: SkinsAdmin,
	staticData: { title: msg`skins` },
});
