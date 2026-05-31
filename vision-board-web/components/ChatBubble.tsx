interface Props {
  role: 'assistant' | 'user';
  content: string;
  isLoading?: boolean;
}

export default function ChatBubble({ role, content, isLoading }: Props) {
  const isLumi = role === 'assistant';

  return (
    <div className={`flex ${isLumi ? 'justify-start' : 'justify-end'} mb-3`}>
      {isLumi && (
        <div
          className="w-7 h-7 rounded-xl flex items-center justify-center mr-2 flex-shrink-0 mt-0.5"
          style={{ background: 'linear-gradient(135deg, #2D2B29 0%, #1C1B19 100%)' }}
        >
          <span className="text-white text-xs">✦</span>
        </div>
      )}
      <div
        className="max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed"
        style={{
          backgroundColor: isLumi ? '#F5F5F3' : '#1C1B19',
          color: isLumi ? '#1C1B19' : '#FFFFFF',
          borderBottomLeftRadius: isLumi ? 4 : undefined,
          borderBottomRightRadius: !isLumi ? 4 : undefined,
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
