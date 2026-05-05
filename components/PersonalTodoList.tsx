"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { getCsrfHeaders } from "@/lib/csrf-client";

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
}

export function PersonalTodoList() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchTodos = useCallback(async () => {
    try {
      const res = await fetch("/api/todos");
      if (res.ok) {
        const data = await res.json();
        setTodos(data.todos ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  async function addTodo(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput("");
    const res = await fetch("/api/todos", {
      method: "POST",
      headers: getCsrfHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ text }),
    });
    if (res.ok) {
      const data = await res.json();
      setTodos((prev) => [data.todo, ...prev]);
    }
  }

  async function toggleTodo(id: string, completed: boolean) {
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, completed: !completed } : t)));
    await fetch(`/api/todos/${id}`, {
      method: "PATCH",
      headers: getCsrfHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ completed: !completed }),
    });
  }

  async function deleteTodo(id: string) {
    setTodos((prev) => prev.filter((t) => t.id !== id));
    await fetch(`/api/todos/${id}`, {
      method: "DELETE",
      headers: getCsrfHeaders(),
    });
  }

  const active = todos.filter((t) => !t.completed);
  const done = todos.filter((t) => t.completed);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-orange-600">My To-Do List</h3>
      <form onSubmit={addTodo} className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Add a task..."
          className="h-9 flex-1 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm focus:border-orange-300 focus:outline-none focus:ring-1 focus:ring-orange-200"
          maxLength={200}
        />
        <button
          type="submit"
          className="flex h-9 w-9 items-center justify-center rounded-md bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50"
          disabled={!input.trim()}
        >
          <Plus size={16} />
        </button>
      </form>

      {loading ? (
        <div className="mt-4 space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-8 animate-pulse rounded bg-slate-100" />)}
        </div>
      ) : (
        <div className="mt-4 space-y-1.5">
          {active.length === 0 && done.length === 0 && (
            <p className="py-4 text-center text-sm text-slate-400 italic">No tasks yet. Add one above.</p>
          )}
          {active.map((todo) => (
            <div key={todo.id} className="group flex items-center gap-2 rounded-md border border-slate-100 bg-slate-50 px-3 py-2 hover:border-orange-200">
              <button
                onClick={() => toggleTodo(todo.id, todo.completed)}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 border-slate-300 text-white hover:border-orange-500"
              >
                &nbsp;
              </button>
              <span className="flex-1 text-sm text-slate-800">{todo.text}</span>
              <button
                onClick={() => deleteTodo(todo.id)}
                className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-opacity"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {done.length > 0 && (
            <div className="mt-3 border-t border-slate-100 pt-2">
              <p className="mb-1.5 text-xs font-medium text-slate-400">Completed ({done.length})</p>
              {done.slice(0, 5).map((todo) => (
                <div key={todo.id} className="group flex items-center gap-2 rounded-md px-3 py-1.5">
                  <button
                    onClick={() => toggleTodo(todo.id, todo.completed)}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 border-emerald-400 bg-emerald-50 text-emerald-600"
                  >
                    <Check size={12} />
                  </button>
                  <span className="flex-1 text-sm text-slate-400 line-through">{todo.text}</span>
                  <button
                    onClick={() => deleteTodo(todo.id)}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-opacity"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {done.length > 5 && <p className="text-xs text-slate-400 pl-9">+{done.length - 5} more</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
