import { exec } from 'child_process';

exec('vite', (error, stdout, stderr) => {
    if (error) {
        console.error('Error occurred during build:', error);
        // Return or continue as needed
        return;
    }
    // Process continued successfully
});
