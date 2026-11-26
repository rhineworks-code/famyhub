import React from 'react';
import { useNavigate } from 'react-router-dom';

const ChatFab = () => {
    const navigate = useNavigate();
    const [position, setPosition] = React.useState({ x: window.innerWidth - 80, y: window.innerHeight - 100 });
    const [isDragging, setIsDragging] = React.useState(false);
    const dragRef = React.useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0 });
    const fabRef = React.useRef(null);

    // Initial position on mount (avoid hydration mismatch/SSR issues)
    React.useEffect(() => {
        const savedPos = localStorage.getItem('chat-fab-pos');
        if (savedPos) {
            try {
                const parsed = JSON.parse(savedPos);
                // Basic bounds check
                const x = Math.min(Math.max(20, parsed.x), window.innerWidth - 70);
                const y = Math.min(Math.max(20, parsed.y), window.innerHeight - 70);
                setPosition({ x, y });
            } catch (e) {
                setPosition({ x: window.innerWidth - 80, y: window.innerHeight - 100 });
            }
        }
    }, []);

    const handleTouchStart = (e) => {
        const touch = e.touches[0];
        dragRef.current = {
            startX: touch.clientX,
            startY: touch.clientY,
            initialX: position.x,
            initialY: position.y
        };
        setIsDragging(false); // Reset dragging state
    };

    const handleTouchMove = (e) => {
        const touch = e.touches[0];
        const dx = touch.clientX - dragRef.current.startX;
        const dy = touch.clientY - dragRef.current.startY;

        // If moved more than 5px, it's a drag, not a click
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
            setIsDragging(true);

            // Keep within bounds
            const newX = Math.min(Math.max(20, dragRef.current.initialX + dx), window.innerWidth - 70);
            const newY = Math.min(Math.max(20, dragRef.current.initialY + dy), window.innerHeight - 70);

            setPosition({ x: newX, y: newY });
        }
    };

    const handleTouchEnd = () => {
        if (!isDragging) {
            navigate('/chat');
        } else {
            localStorage.setItem('chat-fab-pos', JSON.stringify(position));
        }
        setIsDragging(false);
    };

    return (
        <div
            ref={fabRef}
            style={{
                position: 'fixed',
                left: position.x,
                top: position.y,
                touchAction: 'none',
                zIndex: 999
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className={`w-16 h-16 bg-brand-dark text-white rounded-[1rem] shadow-2xl flex items-center justify-center cursor-move transition-transform active:scale-95 ${isDragging ? 'opacity-90 scale-110' : 'animate-bounce-subtle'}`}
        >
            <div className="relative pointer-events-none">
                <i className="ri-chat-smile-2-fill text-3xl"></i>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-brand-light border border-brand-dark rounded-full"></div>
            </div>
        </div>
    );
};

export default ChatFab;
