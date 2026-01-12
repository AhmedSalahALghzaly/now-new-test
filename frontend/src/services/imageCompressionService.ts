/**
 * Image Compression Service
 * Compresses images >1MB by 50% while preserving PNG format
 * Uses expo-image-manipulator for client-side processing
 */
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';

export interface CompressionResult {
  uri: string;
  base64?: string;
  width: number;
  height: number;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  format: 'png' | 'jpeg';
  wasCompressed: boolean;
}

// 1MB threshold in bytes
const SIZE_THRESHOLD_BYTES = 1 * 1024 * 1024;

// Compression quality (50% = 0.5)
const COMPRESSION_QUALITY = 0.5;

class ImageCompressionService {
  /**
   * Get the file size of an image from its URI
   */
  async getImageSize(uri: string): Promise<number> {
    try {
      // Handle base64 images
      if (uri.startsWith('data:image')) {
        const base64Data = uri.split(',')[1];
        // Each base64 character represents 6 bits, so multiply by 3/4 to get bytes
        return Math.ceil((base64Data.length * 3) / 4);
      }
      
      // Handle file URIs
      const info = await FileSystem.getInfoAsync(uri);
      return info.exists ? (info.size || 0) : 0;
    } catch (error) {
      console.error('[ImageCompression] Error getting image size:', error);
      return 0;
    }
  }

  /**
   * Detect if image is PNG based on URI or base64 data
   */
  isPngImage(uri: string): boolean {
    // Check URI extension
    if (uri.toLowerCase().endsWith('.png')) return true;
    
    // Check base64 header
    if (uri.startsWith('data:image/png')) return true;
    
    return false;
  }

  /**
   * Compress an image if it exceeds 1MB
   * Preserves PNG format for PNG images
   */
  async compressImage(uri: string, preserveFormat: boolean = true): Promise<CompressionResult> {
    try {
      const originalSize = await this.getImageSize(uri);
      const isPng = this.isPngImage(uri);
      const outputFormat = preserveFormat && isPng ? ImageManipulator.SaveFormat.PNG : ImageManipulator.SaveFormat.JPEG;
      
      console.log(`[ImageCompression] Processing image: ${originalSize} bytes, format: ${isPng ? 'PNG' : 'JPEG'}`);

      // If image is under threshold, return original
      if (originalSize < SIZE_THRESHOLD_BYTES) {
        console.log('[ImageCompression] Image under 1MB, skipping compression');
        
        // Get image dimensions
        const info = await ImageManipulator.manipulateAsync(uri, [], { base64: true });
        
        return {
          uri: info.uri,
          base64: info.base64,
          width: info.width,
          height: info.height,
          originalSize,
          compressedSize: originalSize,
          compressionRatio: 1,
          format: isPng ? 'png' : 'jpeg',
          wasCompressed: false,
        };
      }

      // Compress the image by 50%
      console.log('[ImageCompression] Compressing image by 50%...');
      
      // For PNG, we use resize to reduce file size (PNG is lossless, so quality doesn't apply)
      // For JPEG, we use compress quality
      let manipulatedImage;
      
      if (isPng && preserveFormat) {
        // For PNG: Reduce dimensions to achieve ~50% file size reduction
        // Since PNG is lossless, we need to reduce actual pixels
        const scaleFactor = Math.sqrt(COMPRESSION_QUALITY); // ~0.707 for 50% reduction
        
        manipulatedImage = await ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: undefined, height: undefined } }], // First get dimensions
          { format: ImageManipulator.SaveFormat.PNG, base64: true }
        );
        
        // Now resize with scale factor
        const newWidth = Math.floor(manipulatedImage.width * scaleFactor);
        const newHeight = Math.floor(manipulatedImage.height * scaleFactor);
        
        manipulatedImage = await ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: newWidth, height: newHeight } }],
          { format: ImageManipulator.SaveFormat.PNG, base64: true }
        );
      } else {
        // For JPEG: Use compress quality
        manipulatedImage = await ImageManipulator.manipulateAsync(
          uri,
          [],
          { compress: COMPRESSION_QUALITY, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );
      }

      // Calculate compressed size from base64
      const compressedSize = manipulatedImage.base64
        ? Math.ceil((manipulatedImage.base64.length * 3) / 4)
        : await this.getImageSize(manipulatedImage.uri);
      
      const compressionRatio = originalSize > 0 ? compressedSize / originalSize : 1;
      
      console.log(`[ImageCompression] Compressed: ${originalSize} -> ${compressedSize} bytes (${(compressionRatio * 100).toFixed(1)}%)`);

      return {
        uri: manipulatedImage.uri,
        base64: manipulatedImage.base64,
        width: manipulatedImage.width,
        height: manipulatedImage.height,
        originalSize,
        compressedSize,
        compressionRatio,
        format: isPng && preserveFormat ? 'png' : 'jpeg',
        wasCompressed: true,
      };
    } catch (error) {
      console.error('[ImageCompression] Compression failed:', error);
      throw error;
    }
  }

  /**
   * Compress multiple images
   */
  async compressImages(uris: string[]): Promise<CompressionResult[]> {
    const results: CompressionResult[] = [];
    
    for (const uri of uris) {
      try {
        const result = await this.compressImage(uri);
        results.push(result);
      } catch (error) {
        console.error(`[ImageCompression] Failed to compress image: ${uri}`, error);
      }
    }
    
    return results;
  }

  /**
   * Convert image to base64 with optional compression
   */
  async toBase64WithCompression(uri: string): Promise<string | null> {
    try {
      const result = await this.compressImage(uri);
      
      if (result.base64) {
        const mimeType = result.format === 'png' ? 'image/png' : 'image/jpeg';
        return `data:${mimeType};base64,${result.base64}`;
      }
      
      return null;
    } catch (error) {
      console.error('[ImageCompression] Failed to convert to base64:', error);
      return null;
    }
  }

  /**
   * Resize image to specific dimensions while maintaining aspect ratio
   */
  async resizeImage(
    uri: string,
    maxWidth: number,
    maxHeight: number,
    preserveFormat: boolean = true
  ): Promise<CompressionResult> {
    try {
      const isPng = this.isPngImage(uri);
      const outputFormat = preserveFormat && isPng ? ImageManipulator.SaveFormat.PNG : ImageManipulator.SaveFormat.JPEG;
      const originalSize = await this.getImageSize(uri);

      // Get original dimensions
      const originalImage = await ImageManipulator.manipulateAsync(uri, [], {});
      const { width: origWidth, height: origHeight } = originalImage;

      // Calculate new dimensions maintaining aspect ratio
      let newWidth = origWidth;
      let newHeight = origHeight;

      if (origWidth > maxWidth || origHeight > maxHeight) {
        const widthRatio = maxWidth / origWidth;
        const heightRatio = maxHeight / origHeight;
        const ratio = Math.min(widthRatio, heightRatio);
        
        newWidth = Math.floor(origWidth * ratio);
        newHeight = Math.floor(origHeight * ratio);
      }

      // Resize
      const resizedImage = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: newWidth, height: newHeight } }],
        { 
          format: outputFormat, 
          compress: isPng ? 1 : COMPRESSION_QUALITY,
          base64: true 
        }
      );

      const compressedSize = resizedImage.base64
        ? Math.ceil((resizedImage.base64.length * 3) / 4)
        : await this.getImageSize(resizedImage.uri);

      return {
        uri: resizedImage.uri,
        base64: resizedImage.base64,
        width: resizedImage.width,
        height: resizedImage.height,
        originalSize,
        compressedSize,
        compressionRatio: originalSize > 0 ? compressedSize / originalSize : 1,
        format: isPng && preserveFormat ? 'png' : 'jpeg',
        wasCompressed: newWidth !== origWidth || newHeight !== origHeight,
      };
    } catch (error) {
      console.error('[ImageCompression] Resize failed:', error);
      throw error;
    }
  }

  /**
   * Compress for upload - combines resize and quality compression
   */
  async compressForUpload(
    uri: string,
    options: {
      maxWidth?: number;
      maxHeight?: number;
      preserveFormat?: boolean;
    } = {}
  ): Promise<CompressionResult> {
    const { maxWidth = 1920, maxHeight = 1080, preserveFormat = true } = options;

    try {
      const originalSize = await this.getImageSize(uri);
      const isPng = this.isPngImage(uri);

      // First resize if needed
      const resized = await this.resizeImage(uri, maxWidth, maxHeight, preserveFormat);

      // Then compress if still over threshold
      if (resized.compressedSize > SIZE_THRESHOLD_BYTES) {
        return await this.compressImage(resized.uri, preserveFormat);
      }

      return resized;
    } catch (error) {
      console.error('[ImageCompression] CompressForUpload failed:', error);
      throw error;
    }
  }
}

export const imageCompressionService = new ImageCompressionService();
export default imageCompressionService;
