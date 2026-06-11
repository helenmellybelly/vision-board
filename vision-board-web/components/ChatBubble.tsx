interface Props {
  role: 'assistant' | 'user';
  content: string;
  isLoading?: boolean;
}

export default function ChatBubble({ role, content, isLoading }: Props) {
  const isTori = role === 'assistant';

  return (
    <div className={`flex ${isTori ? 'justify-start' : 'justify-end'} mb-3`}>
      {isTori && (
        <img
          src="/tori-profile-bust.png"
          alt="토리"
          className="w-8 h-8 rounded-xl object-contain mr-2 flex-shrink-0 mt-0.5"
        />
      )}
      <div
        className="max-w-[85%] md:max-w-[75%] px-4 py-2.5 rounded-2xl text-body md:text-body leading-relaxed whitespace-pre-line"
        style={{
          backgroundColor: isTori ? '#F5F5F3' : '#1C1B19',
          color: isTori ? '#1C1B19' : '#FFFFFF',
          borderBottomLeftRadius: isTori ? 4 : undefined,
          borderBottomRightRadius: !isTori ? 4 : undefined,
        }}
      >
        {isLoading ? (
          <span className="flex gap-1 items-center py-0.5">
            <span className="w-1.5 h-1.5 bg-[#9CA3AF] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 bg-[#9CA3AF] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 bg-[#9CA3AF] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </span>
        ) : (
          content
        )}
      </div>
    </div>
  );
}
