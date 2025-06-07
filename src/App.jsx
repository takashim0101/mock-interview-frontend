// frontend/src/App.jsx
import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [sessionId, setSessionId] = useState('');
  const [conversation, setConversation] = useState([]);
  const [userResponse, setUserResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatStarted, setChatStarted] = useState(false); // New state to manage initial chat start

  // Generate session ID on initial component load
  useEffect(() => {
    if (!sessionId) {
      setSessionId(Date.now().toString());
    }
  }, [sessionId]);

  // Start the chat automatically once sessionId is available
  useEffect(() => {
    if (sessionId && !chatStarted) {
      startChat();
    }
  }, [sessionId, chatStarted]); // Re-run if sessionId or chatStarted changes

  const startChat = async () => {
    setIsLoading(true);
    setConversation([]); // Reset conversation history
    setUserResponse(''); // Clear user's previous input

    try {
      // Send an empty userResponse to trigger Tina's initial prompt from the backend
      const response = await fetch('/chat', { // Changed endpoint to /chat
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId, userResponse: '' }), // Send empty string to trigger initial prompt
      });

      const data = await response.json();
      if (response.ok) {
        setConversation(data.history.map(item => ({
          role: item.role,
          text: item.text
        })));
        setChatStarted(true); // Mark chat as started
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Chat start error:', error);
      alert('An error occurred while starting the insurance consultation.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitResponse = async () => {
    if (!userResponse.trim()) {
      alert('Please enter your response.');
      return;
    }
    setIsLoading(true);

    // Immediately add the user's response to the UI conversation history
    setConversation(prevConv => [...prevConv, { role: 'user', text: userResponse }]);

    try {
      const response = await fetch('/chat', { // Changed endpoint to /chat
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId, userResponse }),
      });

      const data = await response.json();
      if (response.ok) {
        setConversation(data.history.map(item => ({
          role: item.role,
          text: item.text
        })));
        setUserResponse(''); // Clear the response input field
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Response submission error:', error);
      alert('An error occurred while submitting your response.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="App">
      <h1>Tina – Your AI Insurance Policy Assistant</h1>

      {/* Conversation Display Area */}
      <div className="conversation-area">
        {conversation.length === 0 && !isLoading && (
          <p>Starting your insurance consultation with Tina...</p>
        )}
        {conversation.map((msg, index) => (
          <div key={index} className={`message ${msg.role}`}>
            <strong>{msg.role === 'user' ? 'Me:' : 'Tina:'}</strong> {msg.text}
          </div>
        ))}
        {isLoading && <div className="loading-indicator">Tina is thinking...</div>}
      </div>

      {/* Response Input Section */}
      <div className="response-section">
        <textarea
          value={userResponse}
          onChange={(e) => setUserResponse(e.target.value)}
          placeholder="Type your response here..."
          rows="4"
          disabled={isLoading || !chatStarted} // Disable if loading or chat hasn't started
        ></textarea>
        <button
          onClick={handleSubmitResponse}
          disabled={isLoading || !chatStarted} // Disable if loading or chat hasn't started
        >
          Submit
        </button>
      </div>
    </div>
  );
}

export default App;