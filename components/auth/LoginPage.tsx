import React, { useState } from 'react';
import { supabase } from '../../services/supabase';
import LoadingSpinner from '../ui/LoadingSpinner';

const LoginPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [isSignUp, setIsSignUp] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);

        if (isSignUp) {
            const { error } = await supabase.auth.signUp({
                email,
                password,
            });

            if (error) {
                setError(error.message);
            } else {
                setMessage("Conta criada com sucesso! Você já pode fazer login.");
                setIsSignUp(false);
                setPassword('');
            }
        } else {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                setError(error.message);
            } else {
                setMessage("Login bem-sucedido! Redirecionando...");
            }
        }
        setLoading(false);
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
            <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-md">
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-recife-red">Recife<span className="text-gray-800">Mais</span></h1>
                    <p className="mt-2 text-gray-600">AI Content Assistant</p>
                </div>
                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                            Endereço de e-mail
                        </label>
                        <div className="mt-1">
                            <input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="block w-full px-3 py-2 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-recife-red focus:border-recife-red sm:text-sm"
                            />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                            Senha
                        </label>
                        <div className="mt-1">
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete={isSignUp ? "new-password" : "current-password"}
                                required
                                minLength={6}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="block w-full px-3 py-2 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-recife-red focus:border-recife-red sm:text-sm"
                                placeholder={isSignUp ? "Mínimo 6 caracteres" : ""}
                            />
                        </div>
                    </div>
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    {message && <p className="text-sm text-green-600">{message}</p>}
                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="relative flex justify-center w-full px-4 py-2 text-sm font-medium text-white bg-recife-red border border-transparent rounded-md group hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-recife-red disabled:bg-gray-400"
                        >
                            {loading && <div className="absolute inset-y-0 left-0 flex items-center pl-3"><LoadingSpinner/></div>}
                            {isSignUp ? 'Criar Conta' : 'Entrar'}
                        </button>
                    </div>
                    
                    <div className="text-center">
                        <button
                            type="button"
                            onClick={() => {
                                setIsSignUp(!isSignUp);
                                setError(null);
                                setMessage(null);
                                setPassword('');
                            }}
                            className="text-sm text-recife-red hover:text-red-700 font-medium"
                        >
                            {isSignUp ? 'Já tem uma conta? Fazer login' : 'Não tem uma conta? Criar conta'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default LoginPage;
