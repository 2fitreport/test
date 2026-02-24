'use client';

import React from 'react';
import styles from '../companyCreate.module.css';

interface FileViewerPanelProps {
    fileViewerOpen: boolean;
    setFileViewerOpen: (open: boolean) => void;
    selectedFile: { name: string; path: string; size: number } | null;
    setSelectedFile: (file: { name: string; path: string; size: number } | null) => void;
    fileViewUrl: string;
    setFileViewUrl: (url: string) => void;
    fileViewerType: 'image' | 'pdf' | 'office365' | 'none';
    imageZoom: number;
    setImageZoom: (zoom: number | ((prev: number) => number)) => void;
    imagePosition: { x: number; y: number };
    setImagePosition: (pos: { x: number; y: number }) => void;
    imageRotation: number;
    setImageRotation: (rotation: number | ((prev: number) => number)) => void;
    isDragging: boolean;
    setIsDragging: (dragging: boolean) => void;
    dragStart: { x: number; y: number };
    setDragStart: (pos: { x: number; y: number }) => void;
    isMobile: boolean;
    existingFiles: Array<{ name: string; path: string; size: number }>;
    currentFileIndex: number;
    setCurrentFileIndex: (index: number) => void;
    handleViewFile: (file: { name: string; path: string; size: number }, index?: number) => Promise<void>;
    isResizing: boolean;
    sidePanelWidth: number;
    setSidePanelWidth: (width: number) => void;
    setIsResizing: (resizing: boolean) => void;
    handleResizeStart: (e: React.MouseEvent) => void;
}

export default function FileViewerPanel({
    fileViewerOpen,
    setFileViewerOpen,
    selectedFile,
    setSelectedFile,
    fileViewUrl,
    setFileViewUrl,
    fileViewerType,
    imageZoom,
    setImageZoom,
    imagePosition,
    setImagePosition,
    imageRotation,
    setImageRotation,
    isDragging,
    setIsDragging,
    dragStart,
    setDragStart,
    isMobile,
    existingFiles,
    currentFileIndex,
    setCurrentFileIndex,
    handleViewFile,
    isResizing,
    sidePanelWidth,
    setSidePanelWidth,
    setIsResizing,
    handleResizeStart,
}: FileViewerPanelProps) {
    const handleImageWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setImageZoom(prev => Math.min(Math.max(0.5, prev + delta), 3));
    };

    const handleImageMouseDown = (e: React.MouseEvent) => {
        if (imageZoom > 1) {
            setIsDragging(true);
            setDragStart({ x: e.clientX - imagePosition.x, y: e.clientY - imagePosition.y });
        }
    };

    const handleImageMouseMove = (e: React.MouseEvent) => {
        if (isDragging && imageZoom > 1) {
            setImagePosition({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y
            });
        }
    };

    const handleImageMouseUp = () => {
        setIsDragging(false);
    };

    if (isMobile) {
        if (!fileViewerOpen || !selectedFile) return null;

        return (
            <div className={styles.mobileModalOverlay}>
                <div className={styles.mobileModalHeader}>
                    <h3 className={styles.mobileModalTitle}>{selectedFile.name}</h3>
                    <button
                        onClick={() => {
                            setSelectedFile(null);
                            setFileViewUrl('');
                            setFileViewerOpen(false);
                        }}
                        className={styles.mobileModalCloseButton}
                    >
                        ×
                    </button>
                </div>

                <div className={styles.mobileModalContent}>
                    {fileViewerType === 'image' && fileViewUrl && (
                        <img src={fileViewUrl} alt={selectedFile.name} className={styles.mobileModalImage} />
                    )}
                    {fileViewerType === 'pdf' && fileViewUrl && (
                        <iframe
                            src={`https://docs.google.com/gview?url=${encodeURIComponent(fileViewUrl)}&embedded=true`}
                            className={styles.mobileModalIframe}
                        />
                    )}
                    {fileViewerType === 'office365' && fileViewUrl && (
                        <iframe
                            src={`https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(fileViewUrl)}`}
                            className={styles.mobileModalIframe}
                        />
                    )}
                </div>
            </div>
        );
    }

    // PC 사이드 패널 뷰어
    return (
        <>
            <aside className={styles.sidePanel} style={{ width: `${sidePanelWidth}px` }}>
                <div className={styles.sidePanelHeader}>
                    {selectedFile ? (
                        <>
                            <button className={styles.sidePanelBackButton} onClick={() => {
                                setSelectedFile(null);
                                setFileViewUrl('');
                            }}>
                                ← 돌아가기
                            </button>
                            <h3 className={styles.sidePanelTitle}>{selectedFile.name}</h3>
                        </>
                    ) : (
                        <h3 className={styles.sidePanelTitle}>파일 목록</h3>
                    )}
                </div>

                <div className={styles.sidePanelContent}>
                    {selectedFile ? (
                        <div className={styles.fileViewerContainer}>
                            {fileViewerType === 'image' && fileViewUrl && (
                                <div className={styles.fileViewerImageContainer}
                                    onWheel={handleImageWheel}
                                    onMouseDown={handleImageMouseDown}
                                    onMouseMove={handleImageMouseMove}
                                    onMouseUp={handleImageMouseUp}
                                    onMouseLeave={handleImageMouseUp}
                                >
                                    <img
                                        src={fileViewUrl}
                                        alt={selectedFile.name}
                                        className={styles.fileViewerImageZoomable}
                                        style={{
                                            transform: `scale(${imageZoom}) rotate(${imageRotation}deg) translate(${imagePosition.x}px, ${imagePosition.y}px)`,
                                            cursor: imageZoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
                                        }}
                                    />
                                </div>
                            )}
                            {fileViewerType === 'pdf' && fileViewUrl && (
                                <iframe
                                    src={`https://docs.google.com/gview?url=${encodeURIComponent(fileViewUrl)}&embedded=true`}
                                    className={styles.fileViewerIframe}
                                />
                            )}
                            {fileViewerType === 'office365' && fileViewUrl && (
                                <iframe
                                    src={`https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(fileViewUrl)}`}
                                    className={styles.fileViewerIframe}
                                />
                            )}

                            {fileViewerType === 'image' && (
                                <div className={styles.imageControlButtons}>
                                    <button className={styles.imageControlButton} onClick={() => setImageZoom(prev => Math.max(0.5, prev - 0.2))}>
                                        −
                                    </button>
                                    <span className={styles.imagePercentage}>
                                        {Math.round(imageZoom * 100)}%
                                    </span>
                                    <button className={styles.imageControlButton} onClick={() => setImageZoom(prev => Math.min(3, prev + 0.2))}>
                                        +
                                    </button>
                                    <button className={styles.imageControlButton} onClick={() => setImageRotation(prev => (prev + 90) % 360)}>
                                        🔄
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className={styles.fileGridContainer}>
                            {existingFiles.map((file, index) => (
                                <div key={index} className={styles.fileGridItem} onClick={() => handleViewFile(file, index)}>
                                    <div className={styles.fileGridThumbnail}>
                                        <img
                                            src={`/api/file/view?filePath=${encodeURIComponent(file.path)}`}
                                            alt={file.name}
                                            className={styles.fileGridThumbnailImg}
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).src = '/file-icon.svg';
                                            }}
                                        />
                                    </div>
                                    <div className={styles.fileGridName}>{file.name}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div
                    className={`${styles.resizeHandle} ${isResizing ? styles.active : ''}`}
                    onMouseDown={handleResizeStart}
                />
            </aside>
        </>
    );
}
