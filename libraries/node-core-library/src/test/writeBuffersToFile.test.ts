// Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
// See LICENSE in the project root for license information.

const openHandle: jest.Mock<{}> = jest.fn();

const closeSync: jest.Mock<{}> = jest.fn();
const ensureDir: jest.Mock<{}> = jest.fn();
const ensureDirSync: jest.Mock<{}> = jest.fn();
const openSync: jest.Mock<{}> = jest.fn();
const writevSync: jest.Mock<{}> = jest.fn();

jest.mock('fs-extra', () => {
  return {
    closeSync,
    ensureDir,
    ensureDirSync,
    openSync,
    writevSync
  };
});
jest.mock('../Text', () => {
  return {
    Encoding: {
      Utf8: 'utf8'
    }
  };
});

import { getRandomValues } from 'node:crypto';
import fs from 'node:fs';

jest.spyOn(fs, 'promises', 'get').mockImplementation(() => {
  return {
    open: openHandle
  } as unknown as typeof fs.promises;
});

describe('FileSystem', () => {
  const content: Uint8Array[] = [];
  let totalBytes: number = 0;
  let FileSystem: typeof import('../FileSystem').FileSystem;

  beforeAll(async () => {
    FileSystem = (await import('../FileSystem')).FileSystem;
    totalBytes = 0;
    for (let i = 0; i < 10; i++) {
      content[i] = getRandomValues(new Uint8Array(i + 1));
      totalBytes += content[i].length;
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('writeBuffersToFile', () => {
    it('handles a single-shot write', () => {
      const sampleFd: number = 42;
      openSync.mockReturnValue(sampleFd);
      writevSync.mockImplementation((fd: number, buffers: Uint8Array[]) => {
        expect(fd).toEqual(sampleFd);
        expect(buffers).toEqual(content);
        return totalBytes;
      });

      FileSystem.writeBuffersToFile('/fake/path', content);
      expect(openSync).toHaveBeenCalledWith('/fake/path', 'w');
      expect(closeSync).toHaveBeenCalledWith(sampleFd);
      expect(writevSync).toHaveBeenCalledTimes(1);
    });

    for (let i = 0; i < totalBytes; i++) {
      const increment: number = i;
      const expectedCallCount = Math.ceil(totalBytes / increment);
      const expectedData = Buffer.concat(content);
      const sampleFd: number = 42;

      it(`handles a multi-shot write writing ${increment} bytes at a time`, () => {
        const actual = Buffer.alloc(totalBytes);
        let written: number = 0;
        openSync.mockReturnValue(sampleFd);
        writevSync.mockImplementation((fd: number, buffers: Uint8Array[]) => {
          expect(fd).toEqual(sampleFd);
          const writtenThisTime: number = Math.min(increment, totalBytes - written);
          let bufIndex: number = 0;
          let bufOffset: number = 0;
          for (let j = 0; j < writtenThisTime; j++) {
            actual[written] = buffers[bufIndex][bufOffset];
            bufOffset++;
            written++;
            if (bufOffset === buffers[bufIndex].length) {
              bufIndex++;
              bufOffset = 0;
            }
          }
          return writtenThisTime;
        });

        FileSystem.writeBuffersToFile('/fake/path', content);
        expect(openSync).toHaveBeenCalledWith('/fake/path', 'w');
        expect(closeSync).toHaveBeenCalledWith(sampleFd);
        expect(writevSync).toHaveBeenCalledTimes(expectedCallCount);
        expect(actual.equals(expectedData)).toBeTruthy();
      });
    }
  });

  describe('writeBuffersToFileAsync', () => {
    it('handles a single-shot write', async () => {
      const sampleHandle = {
        close: jest.fn(),
        writev: jest.fn()
      };
      openHandle.mockReturnValue(sampleHandle);
      sampleHandle.writev.mockImplementation((buffers: Uint8Array[]) => {
        expect(buffers).toEqual(content);
        return { bytesWritten: totalBytes };
      });

      await FileSystem.writeBuffersToFileAsync('/fake/path', content);
      expect(openHandle).toHaveBeenCalledWith('/fake/path', 'w');
      expect(sampleHandle.close).toHaveBeenCalledTimes(1);
      expect(sampleHandle.writev).toHaveBeenCalledTimes(1);
    });

    for (let i = 0; i < totalBytes; i++) {
      const increment: number = i;
      const expectedCallCount = Math.ceil(totalBytes / increment);
      const expectedData = Buffer.concat(content);
      it(`handles a multi-shot write writing ${increment} bytes at a time`, async () => {
        const sampleHandle = {
          close: jest.fn(),
          writev: jest.fn()
        };
        const actual = Buffer.alloc(totalBytes);
        let written: number = 0;
        openHandle.mockReturnValue(sampleHandle);
        sampleHandle.writev.mockImplementation((buffers: Uint8Array[]) => {
          const writtenThisTime: number = Math.min(increment, totalBytes - written);
          let bufIndex: number = 0;
          let bufOffset: number = 0;
          for (let j = 0; j < writtenThisTime; j++) {
            actual[written] = buffers[bufIndex][bufOffset];
            bufOffset++;
            written++;
            if (bufOffset === buffers[bufIndex].length) {
              bufIndex++;
              bufOffset = 0;
            }
          }
          return { bytesWritten: writtenThisTime };
        });

        await FileSystem.writeBuffersToFileAsync('/fake/path', content);
        expect(openHandle).toHaveBeenCalledWith('/fake/path', 'w');
        expect(sampleHandle.close).toHaveBeenCalledTimes(1);
        expect(sampleHandle.writev).toHaveBeenCalledTimes(expectedCallCount);
        expect(actual.equals(expectedData)).toBeTruthy();
      });
    }
  });
});
