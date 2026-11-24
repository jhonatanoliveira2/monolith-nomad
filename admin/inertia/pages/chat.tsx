import { Head } from '@inertiajs/react'
import ChatComponent from '~/components/chat'
import AppShell from '~/layouts/AppShell'
import { useAiAssistantName } from '~/hooks/use_ai_assistant_name'

export default function Chat(props: { settings: { chatSuggestionsEnabled: boolean } }) {
  const aiAssistantName = useAiAssistantName()
  return (
    // Full-height conversation: the global navigation becomes the icon rail
    <AppShell variant="immersive">
      <div className="w-full h-full">
        <Head title={aiAssistantName} />
        <ChatComponent enabled={true} suggestionsEnabled={props.settings.chatSuggestionsEnabled} />
      </div>
    </AppShell>
  )
}
