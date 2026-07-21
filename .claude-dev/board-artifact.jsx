import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Download } from 'lucide-react';

export default function KanbanBoard() {
  const [board, setBoard] = useState({
    todo: { title: 'To Do', tasks: [] },
    'in-progress': { title: 'In Progress', tasks: [] },
    done: { title: 'Done', tasks: [] }
  });

  const [draggedTask, setDraggedTask] = useState(null);
  const [newTaskColumn, setNewTaskColumn] = useState(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  // Load board from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('kanban-board');
    if (saved) {
      try {
        setBoard(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load board:', e);
      }
    }
  }, []);

  // Save board to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('kanban-board', JSON.stringify(board));
  }, [board]);

  const addTask = (columnId) => {
    if (!newTaskTitle.trim()) return;

    const newTask = {
      id: Date.now(),
      title: newTaskTitle,
      description: '',
      priority: 'medium',
      created: new Date().toISOString().split('T')[0]
    };

    setBoard(prev => ({
      ...prev,
      [columnId]: {
        ...prev[columnId],
        tasks: [...prev[columnId].tasks, newTask]
      }
    }));

    setNewTaskTitle('');
    setNewTaskColumn(null);
  };

  const deleteTask = (columnId, taskId) => {
    setBoard(prev => ({
      ...prev,
      [columnId]: {
        ...prev[columnId],
        tasks: prev[columnId].tasks.filter(t => t.id !== taskId)
      }
    }));
  };

  const moveTask = (fromColumn, toColumn, taskId) => {
    const task = board[fromColumn].tasks.find(t => t.id === taskId);
    if (!task) return;

    setBoard(prev => ({
      ...prev,
      [fromColumn]: {
        ...prev[fromColumn],
        tasks: prev[fromColumn].tasks.filter(t => t.id !== taskId)
      },
      [toColumn]: {
        ...prev[toColumn],
        tasks: [...prev[toColumn].tasks, task]
      }
    }));
  };

  const handleDragStart = (e, columnId, taskId) => {
    setDraggedTask({ columnId, taskId });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, toColumnId) => {
    e.preventDefault();
    if (draggedTask) {
      moveTask(draggedTask.columnId, toColumnId, draggedTask.taskId);
      setDraggedTask(null);
    }
  };

  const exportBoard = () => {
    const dataStr = JSON.stringify(board, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'board.json';
    link.click();
  };

  const columns = ['todo', 'in-progress', 'done'];

  return (
    <div style={{ padding: '20px', background: '#f5f5f5', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <h1 style={{ margin: 0, fontSize: '28px', color: '#1a1a1a' }}>📋 Project Board</h1>
          <button
            onClick={exportBoard}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              background: '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            <Download size={16} />
            Export JSON
          </button>
        </div>

        {/* Info */}
        <div style={{
          background: 'white',
          padding: '15px',
          borderRadius: '8px',
          marginBottom: '20px',
          fontSize: '13px',
          color: '#666',
          borderLeft: '4px solid #1976d2'
        }}>
          💡 <strong>Tip:</strong> Drag tasks between columns. Changes are auto-saved to your browser. When ready to persist, click "Export JSON" and tell Claude: "Update board.json with this data".
        </div>

        {/* Kanban Board */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
          gap: '20px'
        }}>
          {columns.map(columnId => (
            <div
              key={columnId}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, columnId)}
              style={{
                background: 'white',
                borderRadius: '8px',
                padding: '16px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              {/* Column Header */}
              <h2 style={{
                margin: '0 0 16px 0',
                fontSize: '16px',
                fontWeight: '600',
                color: '#1a1a1a',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                {board[columnId].title}
                <span style={{
                  background: '#f0f0f0',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  color: '#666'
                }}>
                  {board[columnId].tasks.length}
                </span>
              </h2>

              {/* Tasks */}
              <div style={{ flex: 1, minHeight: '400px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {board[columnId].tasks.map(task => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, columnId, task.id)}
                    style={{
                      padding: '12px',
                      background: '#f9f9f9',
                      border: '1px solid #e0e0e0',
                      borderRadius: '6px',
                      cursor: 'grab',
                      transition: 'all 0.2s ease',
                      borderLeft: `4px solid ${task.priority === 'high' ? '#f44336' : task.priority === 'medium' ? '#ff9800' : '#4caf50'}`
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '14px', fontWeight: '500', color: '#1a1a1a', marginBottom: '4px' }}>
                          {task.title}
                        </div>
                        {task.description && (
                          <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                            {task.description}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: '#999' }}>
                          <span style={{
                            background: task.priority === 'high' ? '#ffebee' : task.priority === 'medium' ? '#fff3e0' : '#e8f5e9',
                            color: task.priority === 'high' ? '#c62828' : task.priority === 'medium' ? '#e65100' : '#2e7d32',
                            padding: '2px 6px',
                            borderRadius: '3px'
                          }}>
                            {task.priority}
                          </span>
                          <span>{task.created}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteTask(columnId, task.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#999',
                          cursor: 'pointer',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = '#f44336'}
                        onMouseLeave={(e) => e.currentTarget.style.color = '#999'}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Add Task Button */}
                {newTaskColumn === columnId ? (
                  <div style={{ marginTop: 'auto' }}>
                    <input
                      autoFocus
                      type="text"
                      placeholder="Task title..."
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addTask(columnId)}
                      onBlur={() => newTaskTitle.trim() ? addTask(columnId) : setNewTaskColumn(null)}
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '1px solid #1976d2',
                        borderRadius: '4px',
                        fontSize: '14px',
                        marginBottom: '8px'
                      }}
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => setNewTaskColumn(columnId)}
                    style={{
                      marginTop: 'auto',
                      width: '100%',
                      padding: '10px',
                      background: '#f0f0f0',
                      border: 'none',
                      borderRadius: '4px',
                      color: '#666',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      fontSize: '14px',
                      fontWeight: '500'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#e0e0e0'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#f0f0f0'}
                  >
                    <Plus size={16} />
                    Add task
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
