import { createFileRoute } from '@tanstack/react-router';
import { msg } from '@lingui/core/macro';
import ChatConsole from '../../pages/admin/ChatConsole';

export const Route = createFileRoute('/admin/chat')({
	component: ChatConsole,
	staticData: { title: msg`chat console` },
});
