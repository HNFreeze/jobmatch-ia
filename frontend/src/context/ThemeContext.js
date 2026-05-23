import { createContext, useContext } from 'react';

export const ThemeContext = createContext({ darkMode: false, toggleDarkMode: () => {} });
export const useTheme = () => useContext(ThemeContext);
