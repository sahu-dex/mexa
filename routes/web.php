<?php

use App\Http\Controllers\AdminController;
use App\Http\Controllers\AdminManagementController;
use App\Http\Controllers\ImageUploadController;
use App\Http\Controllers\SiteApiController;
use App\Http\Controllers\SitePageController;
use App\Http\Controllers\TeamProfileController;
use App\Http\Controllers\VideoLibraryController;
use Illuminate\Support\Facades\Route;

Route::get('/admin/setup', [AdminController::class, 'setupForm'])->name('admin.setup');
Route::post('/admin/setup', [AdminController::class, 'setup'])->middleware('throttle:5,1');
Route::get('/admin/login', [AdminController::class, 'loginForm'])->name('admin.login');
Route::post('/admin/login', [AdminController::class, 'login'])->middleware('throttle:8,1');
Route::post('/admin/logout', [AdminController::class, 'logout'])->middleware('admin');

Route::get('/storage/media/{file}', [ImageUploadController::class, 'show'])
    ->where('file', '[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp|gif|mp4|webm|ogg)');

Route::prefix('api')->group(function (): void {
    Route::get('/public/content', [SiteApiController::class, 'content']);
    Route::get('/public/services', [SiteApiController::class, 'services']);
    Route::get('/public/packages', [SiteApiController::class, 'packages']);
    Route::get('/public/team', [SiteApiController::class, 'team']);
    Route::get('/public/contact', [SiteApiController::class, 'contact']);
    Route::get('/public/work', [SiteApiController::class, 'work']);
    Route::get('/public/videos', [SiteApiController::class, 'videos']);
    Route::get('/public/video-resolve', [SiteApiController::class, 'videoResolve']);
    Route::get('/public/reviews', [SiteApiController::class, 'reviews']);
    Route::post('/public/reviews', [SiteApiController::class, 'submitReview'])->middleware('throttle:10,1');
    Route::post('/public/storage', [SiteApiController::class, 'storePublicData'])->middleware('throttle:20,1');

    Route::middleware('admin')->prefix('admin')->group(function (): void {
        Route::get('/state', [SiteApiController::class, 'adminState']);
        Route::get('/approvals', [AdminManagementController::class, 'approvals']);
        Route::post('/reviews/{review}/{decision}', [AdminManagementController::class, 'decideReview']);
        Route::post('/team-submissions/{submission}/{decision}', [AdminManagementController::class, 'decideTeamSubmission']);
        Route::delete('/team-submissions/{submission}', [AdminManagementController::class, 'deleteTeamSubmission']);
        Route::post('/password', [SiteApiController::class, 'updatePassword'])->middleware('throttle:5,1');

        Route::middleware('admin.owner')->group(function (): void {
            Route::put('/state/{section}', [SiteApiController::class, 'updateSection']);
            Route::get('/media', [ImageUploadController::class, 'index']);
            Route::post('/media', [ImageUploadController::class, 'store'])->middleware('throttle:20,1');
            Route::delete('/media/{media}', [ImageUploadController::class, 'destroy']);
            Route::post('/images', [ImageUploadController::class, 'store'])->middleware('throttle:15,1');
            Route::get('/images', [ImageUploadController::class, 'index']);
            Route::get('/video-preview', [SiteApiController::class, 'videoPreview']);
            Route::get('/videos', [VideoLibraryController::class, 'index']);
            Route::post('/videos', [VideoLibraryController::class, 'store']);
            Route::put('/videos/{video}', [VideoLibraryController::class, 'update']);
            Route::delete('/videos/{video}', [VideoLibraryController::class, 'destroy']);
            Route::post('/team/{member}/profile-link', [AdminManagementController::class, 'profileLink']);
            Route::get('/moderators', [AdminManagementController::class, 'moderators']);
            Route::post('/moderators', [AdminManagementController::class, 'storeModerator']);
            Route::delete('/moderators/{user}', [AdminManagementController::class, 'deleteModerator']);
        });
    });
});

Route::middleware('admin')->get('/admin', [AdminController::class, 'dashboard'])->name('admin.dashboard');

Route::get('/admin-team', fn () => redirect('/admin'));
Route::get('/admin-team.html', fn () => redirect('/admin'));
Route::get('/admin.html', fn () => redirect('/admin'));

Route::get('/', [SitePageController::class, 'home'])->name('home');
Route::get('/service', [SitePageController::class, 'service'])->name('service');
Route::get('/work', [SitePageController::class, 'work'])->name('work');
Route::get('/reviews', [SitePageController::class, 'reviews'])->name('reviews');
Route::get('/team', [SitePageController::class, 'team'])->name('team');
Route::get('/book', [SitePageController::class, 'booking'])->name('booking');
Route::get('/team/profile/{token}', [TeamProfileController::class, 'edit'])->name('team.profile.edit');
Route::post('/api/public/team-profile/{token}', [TeamProfileController::class, 'submit'])->middleware('throttle:5,1');

// Keep old bookmarked HTML URLs working after the Laravel conversion.
Route::get('/mexa motion.html', [SitePageController::class, 'home']);
Route::get('/mexa%20motion.html', [SitePageController::class, 'home']);
Route::get('/service.html', [SitePageController::class, 'service']);
Route::get('/work.html', [SitePageController::class, 'work']);
Route::get('/review.html', [SitePageController::class, 'reviews']);
Route::get('/team.html', [SitePageController::class, 'team']);
Route::get('/contact-founder.html', [SitePageController::class, 'booking']);

Route::fallback(fn () => response()->view('errors.404', [], 404));
