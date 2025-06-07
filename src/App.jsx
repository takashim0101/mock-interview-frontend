// frontend/src/App.jsx

// Import core React hooks and functionalities
import React, { useState, useEffect, useRef, useCallback } from 'react';
// Import application-specific CSS styles
import './App.css';
// jsPDF library is loaded via CDN in index.html
// and accessed through the window object, so no direct imports here.
// html2canvas is no longer used for PDF generation, so it's not needed.

function App() {
    // State to manage the session ID
    const [sessionId, setSessionId] = useState('');
    // State to manage the conversation history (user and AI messages)
    const [conversation, setConversation] = useState([]);
    // State to manage the message typed by the user
    const [userResponse, setUserResponse] = useState('');
    // State to indicate if the application is currently loading (e.g., during an API request)
    const [isLoading, setIsLoading] = useState(false);
    // Ref for the chat messages display area, to enable scrolling
    const chatMessagesRef = useRef(null);

    // Function to initialize or reset the chat session
    const initializeChatSession = useCallback(() => {
        let storedSessionId = localStorage.getItem('sessionId');
        if (!storedSessionId) {
            // If no session ID exists, generate a new one and store it
            storedSessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
            localStorage.setItem('sessionId', storedSessionId);
        }
        setSessionId(storedSessionId);
        // Clear conversation history when starting a new session
        setConversation([]);
        setUserResponse('');
    }, []);

    // Effect hook to run once on component mount to set up the initial session
    useEffect(() => {
        initializeChatSession();
    }, [initializeChatSession]);

    // Effect hook to scroll to the bottom of the chat messages whenever the conversation updates
    useEffect(() => {
        if (chatMessagesRef.current) {
            chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
        }
    }, [conversation]);

    /**
     * Sends a message to the backend AI asynchronously.
     * This function is memoized using useCallback to prevent unnecessary re-renders.
     * @param {string} message - The message to send from the user.
     */
    const sendMessageToAI = useCallback(async (message) => {
        // Add the user's message to the UI immediately (unless it's the initial empty message)
        if (message.trim() !== '' || conversation.length > 0) {
            setConversation(prevConv => [...prevConv, { role: 'user', text: message }]);
        }
        setUserResponse(''); // Clear the input field
        setIsLoading(true); // Start showing the loading indicator

        try {
            // Fetch the response from the backend server
            const response = await fetch('http://localhost:3001/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ sessionId, userResponse: message }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP Error! Status: ${response.status}`);
            }

            const data = await response.json();
            // Update the conversation with the full history received from the backend
            setConversation(data.history);
        } catch (error) {
            console.error('Error sending message to AI:', error);
            setConversation(prevConv => [...prevConv, { role: 'ai', text: `Sorry, an error occurred: ${error.message}. Please try again.` }]);
        } finally {
            setIsLoading(false); // Stop showing the loading indicator
        }
    }, [sessionId, conversation.length]); // Recreate if sessionId or conversation length changes

    // Effect hook to trigger the initial AI greeting once the sessionId is available
    useEffect(() => {
        // Only send an initial empty message if the sessionId is ready and the conversation hasn't started yet
        if (sessionId && conversation.length === 0) {
            sendMessageToAI(''); // Send an empty message to trigger the initial AI greeting from the backend
        }
    }, [sessionId, conversation.length, sendMessageToAI]); // Dependency on conversation.length to ensure it only runs once at start

    /**
     * Handles the click event for the send button.
     */
    const handleSendMessage = () => {
        const message = userResponse.trim();
        // Allow sending an empty string (e.g., to initiate chat, or if intentionally empty)
        if (message !== '' || conversation.length === 0) {
            sendMessageToAI(message);
        }
    };

    /**
     * Handles the PDF download functionality.
     * This function is memoized using useCallback.
     */
    const handleDownloadPdf = useCallback(async () => {
        setIsLoading(true); // Start showing the loading indicator
        try {
            // Access jsPDF from the window object (loaded via CDN)
            const { jsPDF } = window.jspdf;

            if (!jsPDF) {
                throw new Error("jsPDF library is not loaded. Please check CDN links.");
            }

            const pdf = new jsPDF({
                orientation: 'portrait', // Portrait mode
                unit: 'pt', // Set units to points
                format: 'a4' // A4 page format
            });

            const pageHeight = pdf.internal.pageSize.getHeight();
            const pageWidth = pdf.internal.pageSize.getWidth();
            const margin = 40; // Consistent margin for PDF content
            let currentY = margin; // Starting Y position for content

            // Add header information
            const consultantName = "Tina (AI Insurance Consultant)";
            const conversationDate = new Date().toLocaleDateString('en-NZ', { // Date format for New Zealand English
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });

            // Attempt to extract the recommended policy from the latest AI message
            let recommendedPolicy = "Not yet recommended";
            for (let i = conversation.length - 1; i >= 0; i--) {
                const msg = conversation[i];
                if (msg.role === 'ai' && msg.text.includes("I recommend **")) {
                    const match = msg.text.match(/I recommend \*\*(.*?)\*\*/);
                    if (match && match[1]) {
                        recommendedPolicy = match[1].trim();
                        break;
                    }
                }
            }

            // --- Add Header Content ---
            pdf.setFontSize(12);
            pdf.text(`Insurance Consultation Summary`, margin, currentY);
            currentY += 20;
            pdf.setFontSize(10);
            pdf.text(`Tracking ID: ${sessionId}`, margin, currentY);
            currentY += 15;
            pdf.text(`Consultant: ${consultantName}`, margin, currentY);
            currentY += 15;
            pdf.text(`Recommended Policy: ${recommendedPolicy}`, margin, currentY);
            currentY += 15;
            pdf.text(`Date & Time: ${conversationDate}`, margin, currentY);
            currentY += 25; // Space after header

            // Add a separator line
            pdf.setDrawColor(200, 200, 200); // Light grey color
            pdf.line(margin, currentY, pageWidth - margin, currentY);
            currentY += 20; // Space after line

            // --- Add Conversation Messages ---
            const messageFontSize = 10;
            const lineHeight = 12; // Adjusted approximate line height for readability
            const bubblePaddingX = 10; // Horizontal padding inside the bubble
            const bubblePaddingY = 8;  // Vertical padding inside the bubble
            const borderRadius = 8;    // Corner radius for bubbles
            const maxBubbleWidth = pageWidth - (margin * 2); // Max width a bubble can take

            pdf.setFontSize(messageFontSize);

            for (const msg of conversation) {
                const messagePrefix = msg.role === 'user' ? 'Me:' : 'Tina:';
                const fullMessageText = `${messagePrefix} ${msg.text}`;

                // Split the message into lines based on available text content width (maxBubbleWidth - 2 * bubblePaddingX)
                const textContentRenderWidth = maxBubbleWidth - (bubblePaddingX * 2);
                const splitText = pdf.splitTextToSize(fullMessageText, textContentRenderWidth);

                const textHeight = splitText.length * lineHeight;
                const bubbleHeight = textHeight + (bubblePaddingY * 2);

                // Determine bubble width based on the longest line of text
                const maxTextLineLength = Math.max(...splitText.map(line => pdf.getTextWidth(line)));
                const bubbleWidth = Math.min(maxBubbleWidth, maxTextLineLength + (bubblePaddingX * 2));


                // Check if a new page is needed for the current message bubble
                if (currentY + bubbleHeight + margin > pageHeight) {
                    pdf.addPage();
                    currentY = margin; // Reset Y position for new page
                    pdf.setFontSize(messageFontSize); // Re-set font size after new page
                }

                let bubbleX;
                let textStartX; // X coordinate where the text starts

                // Set fill color and text alignment based on role
                if (msg.role === 'user') {
                    // User's message: light blue background, align right
                    pdf.setFillColor(220, 230, 250); // RGB for light blue (similar to Tailwind's blue-100)
                    pdf.setTextColor(0, 0, 0); // Black text
                    bubbleX = pageWidth - margin - bubbleWidth; // Align bubble to the right
                    textStartX = bubbleX + bubblePaddingX; // Text starts from bubble's left padding
                } else {
                    // AI's message: light grey background, align left
                    pdf.setFillColor(240, 240, 240); // RGB for light grey (similar to Tailwind's gray-100)
                    pdf.setTextColor(0, 0, 0); // Black text
                    bubbleX = margin; // Align bubble to the left
                    textStartX = bubbleX + bubblePaddingX; // Text starts from bubble's left padding
                }
                
                // Draw the rounded rectangle background for the message bubble
                pdf.roundedRect(bubbleX, currentY, bubbleWidth, bubbleHeight, borderRadius, borderRadius, 'F'); // 'F' for fill

                // Add the text on top of the bubble, line by line
                splitText.forEach((line, i) => {
                    let actualTextX = textStartX;
                    // For user messages, re-calculate X for each line to achieve right alignment within the bubble
                    if (msg.role === 'user') {
                        const lineTextWidth = pdf.getTextWidth(line);
                        actualTextX = bubbleX + bubbleWidth - bubblePaddingX - lineTextWidth;
                    }
                    pdf.text(line, actualTextX, currentY + bubblePaddingY + (i * lineHeight));
                });

                currentY += bubbleHeight + 15; // Advance Y for next message, 15 for spacing between bubbles
            }

            pdf.save(`Tina_Insurance_Chat_${new Date().toLocaleDateString()}.pdf`);
            setConversation(prevConv => [...prevConv, { role: 'ai', text: 'Chat history downloaded as PDF!' }]);

        } catch (error) {
            console.error('Error generating PDF:', error);
            setConversation(prevConv => [...prevConv, { role: 'ai', text: 'Failed to download PDF. Please try again.' }]);
        } finally {
            setIsLoading(false); // Hide loading indicator
        }
    }, [conversation, sessionId]); // Dependencies for useCallback

    /**
     * Handles starting a completely new chat session.
     * Clears local storage, resets session ID, and initializes a new conversation.
     */
    const handleStartNewChat = () => {
        localStorage.removeItem('sessionId'); // Clear stored session ID
        initializeChatSession(); // Re-initialize session, which will create a new ID and trigger initial AI greeting
    };

    return (
        <div className="chat-container">
            <div className="chat-header">
                <span className="chat-header-title">Tina - AI Insurance Consultant</span>
                <div className="header-buttons">
                    <button
                        onClick={handleDownloadPdf}
                        disabled={isLoading || conversation.length === 0} // Disable if loading or no conversation yet
                        className="pdf-button mr-2" // Tailwind class for right margin
                    >
                        Download Chat as PDF
                    </button>
                    <button
                        onClick={handleStartNewChat}
                        disabled={isLoading}
                        className="pdf-button mr-2" // Reusing button style, adding margin
                    >
                        Start New Chat
                    </button>
                    {/* Removed: Mute/Unmute Tina button */}
                </div>
            </div>
            <div className="chat-messages" id="chat-messages" ref={chatMessagesRef}>
                {conversation.map((msg, index) => (
                    <div key={index} className={`message ${msg.role}`}>
                        <strong>{msg.role === 'user' ? 'Me:' : 'Tina:'}</strong> {msg.text}
                    </div>
                ))}
                {isLoading && (
                    <div className="loading-indicator">Tina is thinking...</div>
                )}
            </div>
            <div className="chat-input">
                <input
                    type="text"
                    id="user-input"
                    placeholder="Type your message here..."
                    autoComplete="off"
                    value={userResponse}
                    onChange={(e) => setUserResponse(e.target.value)}
                    onKeyUp={(e) => { // Send message when Enter key is pressed
                        if (e.key === 'Enter' && !isLoading) {
                            handleSendMessage();
                        }
                    }}
                    disabled={isLoading}
                />
                <button
                    onClick={handleSendMessage}
                    disabled={isLoading || !sessionId} // Disable if loading or session not ready
                >
                    Send
                </button>
            </div>
        </div>
    );
}

export default App;





