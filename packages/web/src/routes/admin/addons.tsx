import { createFileRoute } from '@tanstack/react-router';
import { msg } from '@lingui/core/macro';
import AddonsAdmin from '../../pages/admin/Addons';

export const Route = createFileRoute('/admin/addons')({
	component: AddonsAdmin,
	staticData: { title: msg`add-ons` },
});
