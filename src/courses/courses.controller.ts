import Lecture from '@/courses/entities/lecture.entity';
import { CreateCourseData, UpdateCourseData } from './dtos/courses.dto';
import JwtGuard from '@/middleware/jwt.guard';
import { FindOptionsSelect } from 'typeorm';
import express, { Response, Router } from 'express';
import { CustomError, IController, UserRole } from '@/commons/interfaces';
import CoursesService from './services/courses.service';
import Course from './entities/course.entity';
import RoleGuard from '@/middleware/role.guard';
import TmpService from './services/temp.service';
import { JwtPayload } from '@/jwt/jwt.dto';
import { validate, validateOrReject } from 'class-validator';
import LearnRecordsService from './services/learn-records.service';
import ChaptersService from './services/chapters.service';
import LearnRecord from './entities/learn-record.entity';
import Chapter from './entities/chapter.entity';
import { CreateChapterData, UpdateChapterData } from './dtos/chapters.dto';
import LecturesService from './services/lectures.service';
import { CreateLectureData, UpdateLectureData } from './dtos/lectures.dto';

export default class CoursesController implements IController {
  public readonly route: string;
  private readonly router: Router;
  private readonly coursesService: CoursesService;
  private readonly learnRecordsService: LearnRecordsService;
  private readonly chaptersService: ChaptersService;
  private readonly lecturesService: LecturesService;
  private readonly tmpService: TmpService;

  private static readonly courseSelect: FindOptionsSelect<Course> = {
    id: true,
    title: true,
    teacher_id: true,
    category_id: true,
    cover_image: true,
    description: true,
    level: true,
  };
  private static readonly learnRecordSelect: FindOptionsSelect<LearnRecord> = {
    id: true,
    course_id: true,
    student_id: true,
    last_learning_date: true,
    last_lecture_id: true,
    next_lecture_id: true,
  };

  private static readonly chapterSelect: FindOptionsSelect<Chapter> = {
    id: true,
    title: true,
    course_id: true,
    teacher_id: true,
    order: true,
  };

  private static readonly lectureSelect: FindOptionsSelect<Lecture> = {
    id: true,
    title: true,
    course_id: true,
    teacher_id: true,
    chapter_id: true,
    order: true,
    is_public: true,
  };

  constructor() {
    this.coursesService = new CoursesService();
    this.learnRecordsService = new LearnRecordsService();
    this.chaptersService = new ChaptersService();
    this.lecturesService = new LecturesService();
    this.tmpService = new TmpService();
    this.route = '/courses';
    this.router = express.Router();
  }
  private async getApi(service: Function, res: Response) {
    try {
      const result: object | null = await service();
      return res.send(
        result
          ? { ok: true, result }
          : { ok: false, error: '요청 결과를 불러오지 못했습니다.' },
      );
    } catch (e) {
      let error = CustomError.UnExpectedErrorMessage;
      if (e.name === CustomError.ErrorType) error = e.message;
      return res.send({ ok: false, error });
    }
  }

  getRouter() {
    this.router.get('/', (_, res) =>
      this.getApi(
        () =>
          this.coursesService.findAllCourses({
            select: CoursesController.courseSelect,
          }),
        res,
      ),
    ); // 전체 코스 조회
    this.router.get('/search', (req, res) =>
      this.getApi(
        () =>
          this.coursesService.findCoursesByQuery({
            query: req.query.query?.toString() ?? '',
            select: CoursesController.courseSelect,
          }),
        res,
      ),
    );
    this.router.get('/category/:category_id', (req, res) =>
      this.getApi(
        () =>
          this.coursesService.findCoursesByCategoryId({
            category_id: parseInt(req.params.category_id),
            select: CoursesController.courseSelect,
          }),
        res,
      ),
    );

    this.router.get('/learning-list', JwtGuard, (req, res) =>
      this.getApi(async () => {
        const user = new JwtPayload(req.user as Express.User);
        await validateOrReject(user, { whitelist: true });

        const ids = await this.learnRecordsService.findCourseIdsByStudentId({
          student_id: user.id,
        });

        const result = await this.coursesService.findCoursesByIds({
          ids,
          select: CoursesController.courseSelect,
        });
        return result;
      }, res),
    );
    this.router.get('/offering-list', JwtGuard, (req, res) =>
      this.getApi(async () => {
        const user = new JwtPayload(req.user as Express.User);
        await validateOrReject(user, { whitelist: true });
        const result = await this.coursesService.findCoursesByTeacherId({
          teacher_id: user.id,
          select: CoursesController.courseSelect,
        });
        return result;
      }, res),
    );
    this.router.post(
      '/create',
      JwtGuard,
      RoleGuard(UserRole.Teacher),
      (req, res) =>
        this.getApi(async () => {
          const user = new JwtPayload(req.user as Express.User);
          await validateOrReject(user, { whitelist: true });

          // s3로부터 cover_image url을 받아오는 과정
          const cover_image = ''; // s3 url

          const data = new CreateCourseData({
            ...req.body,
            cover_image,
          });
          const errors = await validate(data, { whitelist: true });
          if (errors.length > 0) {
            throw new CustomError('잘못된 값이 입력되었습니다.');
          }
          const result = await this.coursesService.createCourse({
            teacher_id: user.id,
            data,
          });
          return result;
        }, res),
    );
    this.router.post(
      '/:course_id/update',
      JwtGuard,
      RoleGuard(UserRole.Teacher),
      (req, res) =>
        this.getApi(async () => {
          const user = new JwtPayload(req.user as Express.User);
          await validateOrReject(user, { whitelist: true });

          const course_id = parseInt(req.params.course_id);

          const { teacher_id } = await this.coursesService.findCourseById({
            id: course_id,
            select: { teacher_id: true },
          });

          if (teacher_id !== user.id) {
            throw new CustomError('코스 변경 권한이 없습니다.');
          }

          // s3로부터 cover_image url을 받아오는 과정
          // 이전 데이터를 지우는 과정은 update 서비스 내부에서
          const cover_image = ''; // s3 url

          const data = new UpdateCourseData({
            ...req.body,
            cover_image,
          });
          const errors = await validate(data, { whitelist: true });
          if (errors.length > 0) {
            throw new CustomError('잘못된 값이 입력되었습니다.');
          }

          const result = await this.coursesService.updateCourse({
            where: { id: course_id, teacher_id },
            data,
          });
          return result;
        }, res),
    );

    // 코스를 지울 땐, 코스는 삭제되지 않고 챕터와 강의만 삭제된다.
    // deleteCourse는 teacher_id를 0으로 변경하여 해당 교육자로 부터 권한을 제거한다.
    this.router.post(
      '/:course_id/delete',
      JwtGuard,
      RoleGuard(UserRole.Teacher),
      (req, res) =>
        this.getApi(async () => {
          const user = new JwtPayload(req.user as Express.User);
          await validateOrReject(user, { whitelist: true });
          const course_id = parseInt(req.params.course_id);

          await this.lecturesService.deleteLectures({
            course_id,
            teacher_id: user.id,
          });

          await this.chaptersService.deleteChapters({
            course_id,
            teacher_id: user.id,
          });

          const result = await this.coursesService.deleteCourse({
            id: course_id,
            teacher_id: user.id,
          });

          return result;
        }, res),
    );
    this.router.get('/:course_id', (req, res) =>
      this.getApi(
        () =>
          this.coursesService.findCourseById({
            id: parseInt(req.params.course_id),
            select: CoursesController.courseSelect,
          }),
        res,
      ),
    );

    this.router.get('/:course_id/chapters', (req, res) =>
      this.getApi(
        () =>
          this.chaptersService.findChaptersByCourseId({
            course_id: parseInt(req.params.course_id),
            select: CoursesController.chapterSelect,
          }),
        res,
      ),
    ); // 챕터 목록 조회, 강의 정보 포함 x, Chapter[]

    this.router.get('/:course_id/chapters/:chapter_id/lectures', (req, res) =>
      this.getApi(async () => {
        const result = await this.lecturesService.findLecturesByChapterId({
          chapter_id: parseInt(req.params.chapter_id),
          select: CoursesController.lectureSelect,
        });
        return result;
      }, res),
    ); // 챕터 내 강의 정보를 확인하기 위한 간단한 정보, public, Lecture[]

    this.router.use(JwtGuard);
    this.router.get('/:course_id/lectures/:lecture_id/completion-record'); // 해당 강의 이수 여부 확인
    this.router.get('/:course_id/lectures/:lecture_id/detail', (req, res) =>
      this.getApi(async () => {
        const user = new JwtPayload(req.user as Express.User);
        await validateOrReject(user, { whitelist: true });
        const course_id = parseInt(req.params.course_id);

        const { teacher_id } = await this.coursesService.findCourseById({
          id: course_id,
          select: { teacher_id: true },
        });
        if (teacher_id !== user.id) {
          await this.learnRecordsService.findLearnRecord({
            where: { student_id: user.id, course_id },
          });
        } // 내 강의가 아니고 수강 기록이 존재하지 않으면 에러 반환

        const result = await this.lecturesService.findLectureById({
          id: parseInt(req.params.lecture_id),
        });
        return result;
      }, res),
    ); // 강의 이수를 위한 강의 상세 정보 불러오기,

    this.router.get('/:course_id/learn-record', (req, res) =>
      this.getApi(async () => {
        const user = new JwtPayload(req.user as Express.User);
        await validateOrReject(user, { whitelist: true });

        const [learnRecord, count_completion_record] = await Promise.all([
          this.learnRecordsService.findLearnRecord({
            where: {
              student_id: user.id,
              course_id: parseInt(req.params.course_id),
            },
            select: CoursesController.learnRecordSelect,
          }),
          this.tmpService.countCompletionRecord({
            student_id: user.id,
            course_id: parseInt(req.params.course_id),
          }),
        ]);
        return { ...learnRecord, count_completion_record };
      }, res),
    ); // 수강 기록
    this.router.post('/:course_id/learn', (req, res) =>
      this.getApi(async () => {
        const user = new JwtPayload(req.user as Express.User);
        await validateOrReject(user, { whitelist: true });

        const result = await this.learnRecordsService.createLearnRecord({
          student_id: user.id,
          course_id: parseInt(req.params.course_id),
        });

        return result;
      }, res),
    );

    this.router.use(RoleGuard(UserRole.Teacher));

    this.router.post('/:course_id/chapters/create', (req, res) =>
      this.getApi(async () => {
        const user = new JwtPayload(req.user as Express.User);
        await validateOrReject(user, { whitelist: true });

        const data = new CreateChapterData(req.body);
        const errors = await validate(data, { whitelist: true });
        if (errors.length > 0) {
          throw new CustomError('잘못된 값이 입력되었습니다.');
        }
        const course_id = parseInt(req.params.course_id);

        await this.coursesService.findCourseById({
          id: course_id,
          select: { teacher_id: true },
        }); // 내 소유의 코스 중 해당 강의가 없으면 오류

        const result = await this.chaptersService.createChapter({
          where: {
            teacher_id: user.id,
            course_id,
          },
          data,
        });
        return result;
      }, res),
    );
    this.router.post('/:course_id/chapters/:chapter_id/update', (req, res) =>
      this.getApi(async () => {
        const user = new JwtPayload(req.user as Express.User);
        await validateOrReject(user, { whitelist: true });

        const data = new UpdateChapterData(req.body);
        const errors = await validate(data, { whitelist: true });
        if (errors.length > 0) {
          throw new CustomError('잘못된 값이 입력되었습니다.');
        }

        const result = await this.chaptersService.updateChapter({
          where: {
            id: parseInt(req.params.chapter_id),
            teacher_id: user.id,
          },
          data,
        });
        return result;
      }, res),
    );
    this.router.post('/:course_id/chapters/:chapter_id/delete', (req, res) =>
      this.getApi(async () => {
        const user = new JwtPayload(req.user as Express.User);
        await validateOrReject(user, { whitelist: true });

        const result = await this.chaptersService.deleteChapter({
          id: parseInt(req.params.chapter_id),
          teacher_id: user.id,
        });
        return result;
      }, res),
    );
    // 포함된 강의또한 제거한다. 따라서 내부 강의가 다른 챕터로 이동할 경우를 대비해
    // 프론트측에서 delete작업은 모든 수정, 생성 작업이 완료된 후 실행하도록 약속한다.
    // 혹은 포함된 작업을 제거하지 않도록 수정후 챕터와의 연결성을 잃은 강의들을 처리할 방법을 생각해야함

    this.router.post('/:course_id/lectures/create', (req, res) =>
      this.getApi(async () => {
        const user = new JwtPayload(req.user as Express.User);
        await validateOrReject(user, { whitelist: true });
        const course_id = parseInt(req.params.course_id);

        await this.coursesService.findCourseById({
          id: course_id,
          select: { teacher_id: true },
        }); // 내 소유의 코스 중 해당 코스가 없으면 오류 -> 권한 확인

        // s3 에서 video_url 받아오는 과정 필요
        const video_url = '';
        const data = new CreateLectureData({
          ...req.body,
          video_url,
        });
        const errors = await validate(data, { whitelist: true });
        if (errors.length > 0)
          throw new CustomError('잘못된 값이 입력되었습니다.');
        // 입력값 검증 과정

        const result = await this.lecturesService.createLecture({
          where: { teacher_id: user.id, course_id },
          data,
        });
        return result;
      }, res),
    );
    this.router.post('/:course_id/lectures/:lecture_id/update', (req, res) =>
      this.getApi(async () => {
        const user = new JwtPayload(req.user as Express.User);
        await validateOrReject(user, { whitelist: true });
        const course_id = parseInt(req.params.course_id);
        const lecture_id = parseInt(req.params.lecture_id);

        await this.coursesService.findCourseById({
          id: course_id,
          select: { teacher_id: true },
        }); // 내 소유의 코스 중 해당 코스가 없으면 오류 -> 권한 확인

        // s3 에서 video_url 받아오는 과정 필요
        const video_url = '';
        const data = new UpdateLectureData({
          ...req.body,
          video_url,
        });
        const errors = await validate(data, { whitelist: true });
        if (errors.length > 0)
          throw new CustomError('잘못된 값이 입력되었습니다.');
        // 입력값 검증 과정

        const result = await this.lecturesService.updateLecutre({
          where: { teacher_id: user.id, course_id, id: lecture_id },
          data,
        });
        return result;
      }, res),
    );
    this.router.post('/:course_id/lectures/:lecture_id/delete', (req, res) =>
      this.getApi(async () => {
        const user = new JwtPayload(req.user as Express.User);
        await validateOrReject(user, { whitelist: true });
        const course_id = parseInt(req.params.course_id);
        const lecture_id = parseInt(req.params.lecture_id);

        const result = await this.lecturesService.deleteLecture({
          id: lecture_id,
          teacher_id: user.id,
          course_id,
        });
        return result;
      }, res),
    );

    return this.router;
  }
}