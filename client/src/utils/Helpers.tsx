import { Href, router } from "expo-router";

export const resetAndNavigate = (newPath: Href) => {
    try {
        // Use replace to reset navigation stack without needing dismissAll
        // This is safer and avoids POP_TO_TOP warnings
        router.replace(newPath);
    } catch (error) {
        // Fallback: if replace fails, try push
        console.log("Navigation error:", error);
        router.push(newPath);
    }
}

