import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class UserService {
    private readonly logger = new Logger(UserService.name);
    private authAxiosInstance: AxiosInstance;

    constructor(private configService: ConfigService) {
        const authServiceUrl = this.configService.get<string>('AUTH_SERVICE_URL');
        const serviceToken = this.configService.get<string>('SERVICE_INTERNAL_TOKEN');

        this.authAxiosInstance = axios.create({
            baseURL: authServiceUrl,
            headers: {
                'x-internal-token': serviceToken,
                'Content-Type': 'application/json',
            },
            timeout: 10000, // 10 seconds timeout
        });
    }

   /**
    * Fetch user details by user ID
    * @param userId - ID of the user to fetch
    * @returns User details or null if not found/error
    */
   async getUserById(userId: string): Promise<{ id: string; name: string; email: string; avatarUrl: string | null } | null> {
    try {
        const response = await this.authAxiosInstance.get(`/api/auth/internal/users/${userId}`);
        return response.data;
    } catch (error) {
        if (error instanceof Error) {
            this.logger.error(`Failed to fetch user ${userId}: ${JSON.stringify(error.message)}`);
        } else {
            this.logger.error(`Failed to fetch user ${userId}:`, 'Unknown error');
        }
        return null; // Return null on error to allow graceful handling
    }
   }

   /**
    * Fetch multiple users by their IDs
    * @param userIds - Array of user IDs to fetch
    * @returns Array of user details
    */
    async getManyUsersByIds(userIds: string[]): Promise<{ id: string; name: string; email: string; avatarUrl: string | null }[]> {
        try {
            const response = await this.authAxiosInstance.post('/api/auth/internal/users/batch', { userIds });
            return response.data;
        } catch (error) {
            if (error instanceof Error) {
                this.logger.error(`Failed to fetch users ${userIds.join(', ')}: ${JSON.stringify(error.message)}`);
            } else {
                this.logger.error(`Failed to fetch users ${userIds.join(', ')}:`, 'Unknown error');
            }
            return []; // Return empty array on error to allow graceful handling
        }
    }
}
